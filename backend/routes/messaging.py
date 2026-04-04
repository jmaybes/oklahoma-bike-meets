from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from bson import ObjectId

from database import db
from models import MessageCreate
from helpers import send_push_notification

router = APIRouter()


@router.post("/messages")
async def send_message(message: MessageCreate):
    message_dict = message.dict()
    message_dict["createdAt"] = datetime.utcnow().isoformat()
    message_dict["isRead"] = False

    result = await db.messages.insert_one(message_dict)
    created_message = await db.messages.find_one({"_id": result.inserted_id})

    # Send push notification to recipient
    recipient = await db.users.find_one({"_id": ObjectId(message.recipientId)})
    sender = await db.users.find_one({"_id": ObjectId(message.senderId)})

    if recipient and recipient.get("pushToken") and recipient.get("notificationsEnabled", True):
        sender_name = sender.get("nickname") or sender.get("name", "Someone") if sender else "Someone"
        await send_push_notification(
            push_token=recipient["pushToken"],
            title=f"New message from {sender_name}",
            body=message.content[:100] + ("..." if len(message.content) > 100 else ""),
            data={
                "type": "message",
                "senderId": message.senderId,
                "senderName": sender_name
            }
        )

    return {
        "id": str(created_message["_id"]),
        "senderId": created_message["senderId"],
        "recipientId": created_message["recipientId"],
        "content": created_message["content"],
        "isRead": created_message["isRead"],
        "createdAt": created_message["createdAt"]
    }


@router.get("/messages/conversations/{user_id}")
async def get_conversations(user_id: str):
    messages = await db.messages.find({
        "$or": [{"senderId": user_id}, {"recipientId": user_id}]
    }).sort("createdAt", -1).to_list(1000)

    conversations = {}
    # Collect all unique partner IDs first
    partner_ids_set = set()
    for msg in messages:
        partner_id = msg["recipientId"] if msg["senderId"] == user_id else msg["senderId"]
        partner_ids_set.add(partner_id)

    # Batch fetch all partners in one query (fixes N+1)
    if partner_ids_set:
        partners_list = await db.users.find(
            {"_id": {"$in": [ObjectId(pid) for pid in partner_ids_set]}},
            {"_id": 1, "name": 1, "nickname": 1}
        ).to_list(len(partner_ids_set))
        partners_map = {str(p["_id"]): p for p in partners_list}
    else:
        partners_map = {}

    for msg in messages:
        partner_id = msg["recipientId"] if msg["senderId"] == user_id else msg["senderId"]

        if partner_id not in conversations:
            partner = partners_map.get(partner_id)
            if partner:
                conversations[partner_id] = {
                    "partnerId": partner_id,
                    "partnerName": partner["name"],
                    "partnerNickname": partner.get("nickname", ""),
                    "lastMessage": msg["content"],
                    "lastMessageTime": msg["createdAt"],
                    "unreadCount": 0
                }

        if partner_id in conversations and msg["recipientId"] == user_id and not msg.get("isRead", False):
            conversations[partner_id]["unreadCount"] += 1

    return list(conversations.values())


@router.get("/messages/thread/{user_id}/{partner_id}")
async def get_message_thread(user_id: str, partner_id: str):
    messages = await db.messages.find({
        "$or": [
            {"senderId": user_id, "recipientId": partner_id},
            {"senderId": partner_id, "recipientId": user_id}
        ]
    }).sort("createdAt", 1).to_list(1000)

    # Mark messages as read
    await db.messages.update_many(
        {"senderId": partner_id, "recipientId": user_id, "isRead": False},
        {"$set": {"isRead": True}}
    )

    result = []
    for msg in messages:
        m = {
            "id": str(msg["_id"]),
            "senderId": msg["senderId"],
            "recipientId": msg["recipientId"],
            "content": msg["content"],
            "isRead": msg.get("isRead", False),
            "createdAt": msg["createdAt"],
        }
        if msg.get("isPopupInvite"):
            m["isPopupInvite"] = True
            m["locationShareId"] = msg.get("locationShareId", None)
        result.append(m)
    return result


# ==================== Online Status ====================

@router.get("/messages/online/{user_id}")
async def check_user_online(user_id: str):
    """Check if a user is currently online"""
    from routes.websocket import ws_manager
    return {"online": ws_manager.is_online(user_id)}


@router.get("/messages/online")
async def get_online_users():
    """Get list of all online users"""
    from routes.websocket import ws_manager
    return {"online_users": ws_manager.get_online_users()}
