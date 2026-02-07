import json
import os
import asyncio
from datetime import datetime
from typing import TypedDict, Annotated, List, Any, Union
from dotenv import load_dotenv
from google import genai
from google.genai import types

from langgraph.graph import StateGraph, END
from langchain_core.callbacks.manager import adispatch_custom_event
from langchain_core.runnables import RunnableConfig

import database
import tools
import prompts

load_dotenv()

# Initialize Google Gen AI Client
# We use the same client for sync operations, and will access .aio for async
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")

# Define Tool Functions Map
TOOL_FUNCTIONS = {
    # Core CRUD
    "create_task": tools.create_task,
    "update_task": tools.update_task,
    "delete_task": tools.delete_task,
    "bulk_update_tasks": tools.bulk_update_tasks,
    "create_goal": tools.create_goal,
    "update_goal": tools.update_goal,
    "list_tasks": tools.list_tasks,
    "list_goals": tools.list_goals,
    # Analytics
    "get_task_stats": tools.get_task_stats,
    "get_overdue_tasks": tools.get_overdue_tasks,
    "get_goal_progress": tools.get_goal_progress,
    "get_rescheduled_tasks": tools.get_rescheduled_tasks,
    "get_streak_data": tools.get_streak_data,
    # Habits
    "create_habit": tools.create_habit,
    "log_habit": tools.log_habit,
    "get_habit_streaks": tools.get_habit_streaks,
    # User Profile
    "update_profile": tools.update_profile,
    "get_profile": tools.get_profile,
    # Reflections
    "save_reflection": tools.save_reflection,
    "get_recent_reflections": tools.get_recent_reflections,
    # Proactive
    "schedule_wake_up": tools.schedule_wake_up,
}

# The SDK expects the actual list of functions for configuration
TOOL_CALLABLES = list(TOOL_FUNCTIONS.values())

# ... (rest of imports)

# --- HELPER: Context ---
# Local definition removed in favor of prompts.get_system_context()


def load_history_from_db() -> List[types.Content]:
    """
    Loads recent messages from DB and converts them to Google GenAI Content types.
    The current user message should already be saved to DB before calling this.
    """
    _, buffer_dicts = database.get_memory_context() # Unsummarized history
    
    contents = []
    
    for msg in buffer_dicts:
        role = 'user' if msg['role'] == 'user' else 'model'
        
        parts = []
        
        # Text Content
        if msg['content']:
            parts.append(types.Part(text=msg['content']))
            
        # Tool Calls (stored as JSON string in DB)
        if msg['tool_calls']:
            # We stored it as a JSON string, ensuring we parse it back to objects if needed
            # But the SDK expects specific types. 
            # For simplicity in reconstruction, we might represent it as text log if exact reconstruction is hard,
            # BUT for Loop correctness, we should try to reconstruct robustly if possible.
            # However, `database.py` stores simply. 
            # Let's use the text representation for history to save complexity, 
            # OR ideally we don't reload the WHOLE history if we have state.
            # But for a fresh request, we do.
            
            # Simple fallback: Log tool calls in text to avoid type mismatch hell
            parts.append(types.Part(text=f"\n[System Log: Tool Call Executed: {msg['tool_calls']}]"))

        if msg['role'] == 'tool':
            # Tool Output
            # In DB, role='tool' usually has content.
            # Google SDK expects role='user' or 'function' for tool outputs depending on API version.
            # V1beta/GenAI SDK usually treats tool outputs as separate parts or role='user'.
            # Let's map it to 'user' with text Context for now to keep it safe.
             parts.append(types.Part(text=f"\n[System Log: Tool Output: {msg['content']}]"))
        
        if parts:
            contents.append(types.Content(role=role, parts=parts))

    return contents

# --- LANGGRAPH STATE ---
class AgentState(TypedDict):
    messages: List[types.Content]
    user_message_str: str # For DB persistence ref

# --- NODES ---

async def call_model(state: AgentState, config: RunnableConfig):
    messages = state["messages"]
    
    # 1. Configure
    # We always enable tools.
    conf = types.GenerateContentConfig(
        tools=TOOL_CALLABLES,
        system_instruction=prompts.get_system_context(),
        temperature=0.7,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True) # WE HANDLE THIS
    )
    
    print("🤖 Cooper thinking...")
    
    # 2. Call Google Gen AI (Stream supported) with retry for transient errors
    max_retries = 2
    response_stream = None
    for attempt in range(max_retries + 1):
        try:
            response_stream = await client.aio.models.generate_content_stream(
                model=MODEL_NAME,
                contents=messages,
                config=conf
            )
            break
        except Exception as e:
            if attempt < max_retries and ("429" in str(e) or "503" in str(e) or "500" in str(e)):
                wait_time = 2 ** attempt
                print(f"⚠️ Gemini API error (attempt {attempt + 1}): {e}. Retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)
            else:
                raise
    
    full_text = ""
    # We will accumulate the full parts list to preserve thought_signatures
    # and avoiding recreating parts from scratch.
    accumulated_parts = []
    
    async for chunk in response_stream:
        # 3. Emit Tokens (Custom Event)
        if chunk.text:
            token = chunk.text
            full_text += token
            # Dispatch event for frontend
            await adispatch_custom_event("token", {"text": token}, config=config)
            
        # Collect Parts directly to preserve signatures
        # chunk.candidates[0].content.parts contains the rich Part objects
        if chunk.candidates and chunk.candidates[0].content and chunk.candidates[0].content.parts:
            for part in chunk.candidates[0].content.parts:
                if part.function_call:
                    # Capture the part which (hopefully) has the thought_signature
                    accumulated_parts.append(part)

    # 4. Construct Final Message
    final_parts = []
    if full_text:
        final_parts.append(types.Part(text=full_text))
    
    # Add the accumulated tool call parts (with signatures)
    final_parts.extend(accumulated_parts)
    
    final_message = types.Content(role="model", parts=final_parts)
    
    # 5. Persist to DB
    # We need to distinguish if this was a loop or the first reply.
    # For simplicity, we just log every Assistant Turn.
    tool_calls_json = None
    
    # Extract just the function calls for DB logging (which handles JSON safely)
    actual_tool_calls_for_db = []
    for p in accumulated_parts:
        if p.function_call:
            actual_tool_calls_for_db.append(p.function_call)
            
    tool_calls = actual_tool_calls_for_db
    if tool_calls:
        tool_calls_json = json.dumps([{"name": fc.name, "args": fc.args} for fc in tool_calls])
        
    if full_text or tool_calls:
        database.add_message(
            role='assistant', 
            content=full_text, 
            tool_calls=tool_calls_json
        )

    return {"messages": messages + [final_message]}

async def execute_tools(state: AgentState, config: RunnableConfig):
    last_message = state["messages"][-1]
    
    new_parts = []
    
    # Find tool calls
    tool_calls = []
    for part in last_message.parts:
        if part.function_call:
            tool_calls.append(part.function_call)
            
    print(f"🛠️ Executing {len(tool_calls)} tools...")

    for fc in tool_calls:
        name = fc.name
        args = fc.args
        
        # Convert args map to dict
        # GenAI args are usually a Map/dict-like object
        args_dict = dict(args)
        
        output_text = f"Error: Tool {name} not found."
        if name in TOOL_FUNCTIONS:
            try:
                # Run tool (Sync)
                # We could run in executor if needed, but for now direct call
                # Note: args_dict values might be types.xxx, ensure we pass native python types?
                # GenAI usually converts standard JSON types well.
                result = TOOL_FUNCTIONS[name](**args_dict)
                output_text = str(result)
            except Exception as e:
                output_text = f"Error executing {name}: {str(e)}"
        
        # Save Tool Output to DB
        # We record it as a 'tool' role message
        database.add_message(role='tool', content=output_text)

        # Create Response Part (FunctionResponse)
        # Google GenAI expects a FunctionResponse part
        new_parts.append(types.Part(
            function_response=types.FunctionResponse(
                name=name,
                response={"result": output_text} 
            )
        ))
        
        # Emit event log
        await adispatch_custom_event("tool_output", {"name": name, "output": output_text}, config=config)

    # Return as a 'user' message with function responses (Gemini convention)
    # effectively yielding the result back to the model
    response_msg = types.Content(role="user", parts=new_parts)
    
    return {"messages": state["messages"] + [response_msg]}


# --- EDGES ---

def should_continue(state: AgentState):
    last_message = state["messages"][-1]
    # Check if last message has function calls
    for part in last_message.parts:
        if part.function_call:
            return "tools"
    return END

# --- GRAPH BUILD ---

workflow = StateGraph(AgentState)
workflow.add_node("agent", call_model)
workflow.add_node("tools", execute_tools)

workflow.set_entry_point("agent")
workflow.add_conditional_edges("agent", should_continue)
workflow.add_edge("tools", "agent")

app_graph = workflow.compile()

# --- ENTRY POINT ---

async def _stream_generator(state: AgentState):
    """Helper for streaming response tokens."""
    async for event in app_graph.astream_events(state, version="v2"):
        # Filter for custom "token" events
        if event["event"] == "on_custom_event":
            if event["name"] == "token":
                yield types.Part(text=event["data"]["text"])

async def summarize_memory_if_needed(current_summary: str, buffer_dicts: list) -> str:
    """
    Checks if buffer is too large (40+). If so, summarizes the first 20 items
    using structured sections to preserve critical context.
    """
    if len(buffer_dicts) <= 40:
        return current_summary

    # Slice the oldest 20 messages for summarization
    chunk_to_summarize = buffer_dicts[:20]
    last_summarized_id = chunk_to_summarize[-1]['id']

    # Convert chunk to text format
    text_log = ""
    for msg in chunk_to_summarize:
        role = msg['role'].upper()
        content = msg['content'] or (f"[Tool Call] {msg['tool_calls']}" if msg['tool_calls'] else "")
        text_log += f"{role}: {content}\n"

    # Structured Summarization Prompt
    summary_prompt = f"""
You are optimizing the memory for an AI Goal Coach named Cooper.

EXISTING LONG-TERM SUMMARY:
{current_summary}

NEW CHUNK OF CONVERSATION TO MERGE:
{text_log}

INSTRUCTIONS:
Produce an updated summary using EXACTLY these sections. Merge new information into existing sections.

## User Profile Facts
Key facts about the user: name, work schedule, energy patterns, communication style, preferences.
Only include facts explicitly stated or strongly implied by the user.

## Active Commitments
Goals, tasks, and habits the user has committed to. Include deadlines if mentioned.

## Open Loops
Things that were discussed but not resolved — pending decisions, unanswered questions,
tasks the user said they'd do but haven't confirmed completion of.

## Patterns & Insights
Recurring behaviors noticed: procrastination patterns, peak productivity times,
common blockers, what motivates the user, what causes them to stall.

## Recent Decisions
Key decisions made in the most recent conversations (last 2-3 sessions).

RULES:
- Keep each section concise (2-5 bullet points max).
- If a section has no content, write "None yet."
- Discard trivial chit-chat.
- Output ONLY the structured summary — no preamble.
"""

    print(f"Triggering Memory Summarization (Chunk size: {len(chunk_to_summarize)})...")
    try:
        response = await client.aio.models.generate_content(
            model=MODEL_NAME,
            contents=summary_prompt
        )
        new_summary = response.text

        # Save to DB
        database.update_summary(new_summary, last_summarized_id)
        print("Memory Summarization Complete.")

        return new_summary
    except Exception as e:
        print(f"Summarization Failed: {e}")
        return current_summary

async def run_chat_agent_async(user_message: str, stream: bool = False):
    """
    Refactored Agent Runner using LangGraph.
    Returns:
        str: If stream=False (Final response text)
        AsyncGenerator: If stream=True (Yields types.Part)
    """
    # 1. Save User Message
    database.add_message('user', f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] {user_message}")
    
    # 2. Memory Summarization
    summary_text, buffer_dicts = database.get_memory_context()
    await summarize_memory_if_needed(summary_text, buffer_dicts)
    
    # 3. Init State
    initial_messages = load_history_from_db()
    state = AgentState(messages=initial_messages, user_message_str=user_message)
    
    if stream:
        return _stream_generator(state)
    else:
        # Non-streaming call
        final_state = await app_graph.ainvoke(state)
        # Extract last assistant message text
        last_msg = final_state["messages"][-1]
        text = ""
        for p in last_msg.parts:
            if p.text: text += p.text
        return text

# Legacy Wrapper for Sync compatibility (if needed, but main.py will use async)
# We will expose run_chat_agent as the main async entry point now.
run_chat_agent = run_chat_agent_async


# --- PROACTIVE WAKE UP ---
async def wake_cooper(reason: str):
    """
    Proactive entry point. Called by the scheduler.
    Now includes rich context so Cooper can make intelligent decisions.
    """
    try:
        print(f"⚡ Waking Cooper: {reason}")

        # Build rich context payload
        ctx = database.get_wake_context()

        # Format context into readable system event
        sections = []
        sections.append(f"[SYSTEM EVENT]")
        sections.append(f"**Action**: PROACTIVE WAKE UP")
        sections.append(f"**Reason**: {reason}")
        sections.append(f"**Time**: {ctx['time']}")

        # Today's progress
        sections.append(f"\n**Today's Tasks**: {ctx['todays_done']}/{ctx['todays_scheduled']} complete")
        if ctx['todays_remaining']:
            remaining_str = ", ".join(f"'{t['title']}' ({t['priority']})" for t in ctx['todays_remaining'][:5])
            sections.append(f"**Remaining Today**: {remaining_str}")

        # Overdue
        if ctx['overdue_count'] > 0:
            overdue_str = ", ".join(f"'{t['title']}' ({t['days_overdue']}d overdue)" for t in ctx['overdue_tasks'][:3])
            sections.append(f"**OVERDUE ({ctx['overdue_count']})**: {overdue_str}")

        # Blocked
        if ctx['blocked_tasks']:
            blocked_str = ", ".join(f"'{t['title']}' (Reason: {t['blocker_reason']})" for t in ctx['blocked_tasks'][:3])
            sections.append(f"**BLOCKED**: {blocked_str}")

        # Habits
        if ctx['habits_pending_today']:
            habits_str = ", ".join(f"'{h['title']}' (streak: {h['current_streak']}d)" for h in ctx['habits_pending_today'][:5])
            sections.append(f"**Habits Not Logged Today**: {habits_str}")

        # Postponed
        if ctx['postponed_tasks']:
            postponed_str = ", ".join(f"'{t['title']}' ({t['days_postponed']}d)" for t in ctx['postponed_tasks'][:3])
            sections.append(f"**Repeatedly Postponed**: {postponed_str}")

        # Last interaction
        if ctx['hours_since_last_interaction'] is not None:
            sections.append(f"**Hours Since Last User Message**: {ctx['hours_since_last_interaction']}")

        sections.append(f"\n**Instruction**: Based on the above context, decide to Speak, Sleep, or Schedule.")

        trigger_message = "\n".join(sections)

        # Run Agent (No stream)
        response_text = await run_chat_agent_async(user_message=trigger_message, stream=False)

        if "SLEEP" in response_text:
            print("💤 Cooper decided to sleep.")
            return

        from connection_manager import manager
        print(f"🗣️ Cooper speaks: {response_text}")
        await manager.broadcast_message(response_text)

    except Exception as e:
        print(f"❌ Error in wake_cooper: {e}")
