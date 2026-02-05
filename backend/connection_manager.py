from fastapi import WebSocket
from typing import List
import json
import httpx
import asyncio
import database

class ConnectionManager:
    """
    Manages active WebSocket connections and fallback Push Notifications.
    """
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_json(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)

    async def broadcast_message(self, text_message: str):
        """
        Sends a message to all active WebSockets.
        Falls back to Push Notification if no delivery succeeded.
        """
        msg_payload = {"text": text_message, "is_final": True}
        delivered_via_ws = False

        # 1. Try WebSocket Broadcast
        if self.active_connections:
            print(f"📡 Broadcasting via WebSocket to {len(self.active_connections)} clients")
            dead_connections = []
            for connection in self.active_connections:
                try:
                    await connection.send_json(msg_payload)
                    delivered_via_ws = True
                except Exception as e:
                    print(f"Error sending WS: {e}")
                    dead_connections.append(connection)
            for dead in dead_connections:
                self.disconnect(dead)

        # 2. Fallback to Push Notification if no WS delivery succeeded
        if not delivered_via_ws:
            print("📴 No successful WS delivery. Sending Push Notification.")
            await self._send_push_notification(text_message)

    async def _send_push_notification(self, body: str):
        tokens = database.get_push_tokens()
        if not tokens:
            print("⚠️ No push tokens registered.")
            return

        print(f"📲 Sending Push to {len(tokens)} devices...")
        
        messages = []
        for token in tokens:
            if not token.startswith("ExponentPushToken"):
                continue
                
            messages.append({
                "to": token,
                "sound": "default",
                "title": "Cooper",
                "body": body,
                "data": {"url": "/chat"} # Deep link data
            })

        if not messages:
            return

        # Expo API supports batching up to 100 messages
        # Detailed docs: https://docs.expo.dev/push-notifications/sending-notifications/
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    "https://exp.host/--/api/v2/push/send",
                    json=messages,
                    headers={
                        "Accept": "application/json",
                        "Accept-encoding": "gzip, deflate",
                        "Content-Type": "application/json",
                    }
                )
                print(f"Push Response: {response.status_code} {response.text}")
            except Exception as e:
                print(f"Push Error: {e}")

manager = ConnectionManager()
