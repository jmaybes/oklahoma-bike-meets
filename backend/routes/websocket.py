from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List
from datetime import datetime
from bson import ObjectId
import logging

from database import db

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections for real-time messaging"""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info(f"WebSocket connected: {user_id}")

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logger.info(f"WebSocket disconnected: {user_id}")

    async def send_personal_message(self, message: dict, user_id: str):
        """Send message to a specific user"""
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
                return True
            except Exception as e:
                logger.error(f"Error sending message to {user_id}: {e}")
                self.disconnect(user_id)
        return False

    async def broadcast_to_users(self, message: dict, user_ids: List[str]):
        """Send message to multiple users"""
        for user_id in user_ids:
            await self.send_personal_message(message, user_id)

    def is_online(self, user_id: str) -> bool:
        return user_id in self.active_connections

    def get_online_users(self) -> List[str]:
        return list(self.active_connections.keys())


# Global connection manager instance
ws_manager = ConnectionManager()


@router.websocket("/ws/messages/{user_id}")
async def websocket_messages(websocket: WebSocket, user_id: str):
    """WebSocket endpoint for real-time message updates"""
    await ws_manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") == "message":
                message_dict = {
                    "senderId": user_id,
                    "recipientId": data["recipientId"],
                    "content": data["content"],
                    "createdAt": datetime.utcnow().isoformat(),
                    "isRead": False,
                }

                result = await db.messages.insert_one(message_dict)
                created_message = await db.messages.find_one({"_id": result.inserted_id})

                sender = await db.users.find_one({"_id": ObjectId(user_id)})
                sender_name = sender.get("name", "Unknown") if sender else "Unknown"

                ws_message = {
                    "type": "new_message",
                    "message": {
                        "id": str(created_message["_id"]),
                        "senderId": created_message["senderId"],
                        "senderName": sender_name,
                        "recipientId": created_message["recipientId"],
                        "content": created_message["content"],
                        "createdAt": created_message["createdAt"],
                        "isRead": created_message["isRead"],
                    }
                }

                await ws_manager.send_personal_message(ws_message, data["recipientId"])

                await websocket.send_json({
                    "type": "message_sent",
                    "message": ws_message["message"]
                })

            elif data.get("type") == "typing":
                await ws_manager.send_personal_message({
                    "type": "typing",
                    "userId": user_id,
                }, data["recipientId"])

            elif data.get("type") == "read":
                await db.messages.update_many(
                    {"senderId": data["senderId"], "recipientId": user_id, "isRead": False},
                    {"$set": {"isRead": True}}
                )
                await ws_manager.send_personal_message({
                    "type": "messages_read",
                    "readBy": user_id,
                }, data["senderId"])

            elif data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        ws_manager.disconnect(user_id)
    except Exception as e:
        logger.error(f"WebSocket error for {user_id}: {e}")
        ws_manager.disconnect(user_id)
