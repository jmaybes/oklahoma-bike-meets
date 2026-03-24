from fastapi import APIRouter, HTTPException
from datetime import datetime
from bson import ObjectId

from database import db

router = APIRouter()


@router.get("/notifications/{user_id}")
async def get_notifications(user_id: str, unread_only: bool = False):
    query = {"userId": user_id}
    if unread_only:
        query["isRead"] = False

    notifications = await db.notifications.find(query).sort("createdAt", -1).limit(50).to_list(50)
    return [{
        "id": str(notif["_id"]),
        "userId": notif["userId"],
        "eventId": notif.get("eventId"),
        "type": notif.get("type", "general"),
        "title": notif["title"],
        "message": notif["message"],
        "isRead": notif.get("isRead", False),
        "createdAt": notif.get("createdAt")
    } for notif in notifications]


@router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(status_code=400, detail="Invalid notification ID")

    await db.notifications.update_one(
        {"_id": ObjectId(notification_id)},
        {"$set": {"isRead": True}}
    )
    return {"message": "Notification marked as read"}


@router.put("/notifications/user/{user_id}/read-all")
async def mark_all_notifications_read(user_id: str):
    await db.notifications.update_many(
        {"userId": user_id, "isRead": False},
        {"$set": {"isRead": True}}
    )
    return {"message": "All notifications marked as read"}
