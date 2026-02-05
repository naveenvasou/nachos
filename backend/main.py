from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agent import run_chat_agent
from connection_manager import manager
from groq import Groq
import base64
import wave
import os
import shutil
import tempfile
import asyncio
from dotenv import load_dotenv
import database
from typing import Optional, List, Dict, Any
import contextlib
from proactive_scheduler import start_scheduler, stop_scheduler
from flux_stt_service import DeepgramFluxSTTService

load_dotenv()

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    # Initialize Postgres DB if DATABASE_URL is set (Cloud Run)
    if database.DATABASE_URL:
        try:
            database.init_postgres()
            print("Postgres DB initialized successfully")
        except Exception as e:
            print(f"Postgres init error: {e}")
    start_scheduler()
    yield
    # Shutdown
    stop_scheduler()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Groq Client for Audio
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

class ChatRequest(BaseModel):
    message: str

from fastapi.responses import StreamingResponse
import json


class PushTokenRequest(BaseModel):
    token: str

@app.post("/notifications/register-token")
def register_push_token(request: PushTokenRequest):
    """
    Registers an Expo Push Token for the device.
    """
    success = database.save_push_token(request.token)
    if success:
        return {"status": "success", "message": "Token registered"}
    raise HTTPException(status_code=500, detail="Failed to save token")

@app.post("/chat")
async def chat(request: ChatRequest):
    response_text = await run_chat_agent(request.message)
    return {"response": response_text}

@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """
    Streaming chat endpoint that returns tokens as they are generated.
    """
    async def event_generator():
        full_response = ""
        # Get streaming response from agent (Async Generator)
        stream = await run_chat_agent(request.message, stream=True)
        
        print("Starting stream generation...")
        try:
            async for chunk in stream:
                token = chunk.text
                full_response += token
                # Yield SSE format
                yield f"data: {json.dumps({'token': token, 'full_text': full_response})}\n\n"
            
            # Yield final completion event
            yield f"data: {json.dumps({'token': '', 'full_text': full_response, 'done': True})}\n\n"
        except Exception as e:
             print(f"Stream error: {e}")
             yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/chat/history")
async def get_chat_history():
    """
    Returns the recent chat history for the frontend sync.
    """
    messages = database.get_recent_messages(limit=50)
    return messages

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    try:
        print(f"Received file: {file.filename}, type: {file.content_type}")
        # Create temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".m4a") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
        
        # Transcribe with Groq
        with open(tmp_path, "rb") as audio_file:
            transcription = groq_client.audio.transcriptions.create(
                file=(tmp_path, audio_file.read()),
                model="whisper-large-v3",
                response_format="json",
                language="en",
                temperature=0.0
            )
        
        # Cleanup
        os.remove(tmp_path)
        
        return {"text": transcription.text}
    except Exception as e:
        print(f"Transcription Error: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

# --- WebSocket Transcription ---

@app.websocket("/ws/transcribe")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    
    # Initialize Deepgram Flux Service
    stt_service = DeepgramFluxSTTService(
        api_key=os.getenv("DEEPGRAM_API_KEY"),
        sample_rate=16000,
        encoding="linear16"
    )
    
    # Define Callbacks
    async def handle_end_of_turn(transcript: str, data: dict):
        if transcript.strip():
            print(f"STT Final: {transcript}")
            await manager.send_json({
                "text": transcript.strip(),
                "is_final": True,
                "stability": 1.0
            }, websocket)

    async def handle_update(transcript: str):
        if transcript.strip():
            # print(f"STT Interim: {transcript}")
            await manager.send_json({
                "text": transcript.strip(),
                "is_final": False,
                "stability": 0.5
            }, websocket)
            
    stt_service.on_end_of_turn = handle_end_of_turn
    stt_service.on_update = handle_update
    stt_service.on_start_of_turn = lambda t: print(f"User started speaking: {t}")
    
    print("WS: Starting Deepgram Flux Service...")
    if not await stt_service.start():
        print("WS: Failed to start STT service")
        await manager.disconnect(websocket)
        return

    print("WS: Connection accepted, waiting for audio...")
    
    try:
        while True:
            # Handle both Text (Base64) and Binary frames
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                print("WS: Disconnect received")
                break
                
            data = None
            if "text" in message:
                try:
                    data = base64.b64decode(message["text"])
                except Exception as e:
                    print(f"WS: Base64 decode error: {e}")
                    continue
            elif "bytes" in message:
                data = message["bytes"]
            
            if data:
                 await stt_service.send_audio(data)

    except WebSocketDisconnect:
        print("WS: Client disconnected")
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WS Error: {e}")
        import traceback
        traceback.print_exc()
        manager.disconnect(websocket)
    finally:
        await stt_service.stop()


# --- Task API Endpoints ---

class TaskCreate(BaseModel):
    title: str
    goal_id: Optional[int] = None
    priority: str = "MEDIUM"
    due_date: Optional[str] = None
    scheduled_date: Optional[str] = None
    effort: str = "MEDIUM"
    notes: Optional[str] = None

class TaskUpdate(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None
    scheduled_date: Optional[str] = None
    effort: Optional[str] = None
    notes: Optional[str] = None
    blocker_reason: Optional[str] = None

@app.get("/tasks")
def get_tasks(status: Optional[str] = None):
    return database.list_tasks(status)

@app.post("/tasks")
def create_task(task: TaskCreate):
    try:
        task_id = database.create_task(
            title=task.title,
            goal_id=task.goal_id,
            priority=task.priority,
            due_date=task.due_date,
            scheduled_date=task.scheduled_date,
            effort=task.effort,
            notes=task.notes or ""
        )
        return {"status": "success", "task_id": task_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/tasks/{task_id}")
def update_task_endpoint(task_id: int, update: TaskUpdate):
    # Only include set fields in the update
    updates = update.dict(exclude_unset=True)
    
    success = database.update_task(task_id, updates)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"status": "success"}

@app.get("/goals")
def get_goals():
    return database.list_goals()

# --- Debug / Inspector Endpoints ---
import debug
from fastapi.staticfiles import StaticFiles

@app.get("/debug/context")
def get_debug_context_endpoint():
    return debug.get_debug_context()

@app.post("/debug/message/{message_id}")
def update_message_endpoint(message_id: int, content: str):
    success = database.update_message_content(message_id, content)
    if success:
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Message not found")

@app.delete("/debug/message/{message_id}")
def delete_message_endpoint(message_id: int):
    success = database.delete_message(message_id)
    if success:
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Message not found")

# Mount static files for Inspector UI
# Ensure the directory exists
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
if not os.path.exists(STATIC_DIR):
    os.makedirs(STATIC_DIR)

app.mount("/debug/ui", StaticFiles(directory=STATIC_DIR), name="static")
