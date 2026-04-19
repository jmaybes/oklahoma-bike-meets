from fastapi import APIRouter, HTTPException
from datetime import datetime
from bson import ObjectId

from database import db
from helpers import _sid, _isodate, send_push_notification

router = APIRouter()


@router.get("/notifications/{user_id}")
async def get_notifications(user_id: str, unread_only: bool = False):
    query = {"userId": user_id}
    if unread_only:
        query["isRead"] = False

    notifications = await db.notifications.find(query).sort("createdAt", -1).limit(50).to_list(50)
    result = []
    for notif in notifications:
        try:
            result.append({
                "id": str(notif["_id"]),
                "userId": _sid(notif["userId"]),
                "eventId": _sid(notif.get("eventId")),
                "carId": _sid(notif.get("carId")),
                "type": notif.get("type", "general"),
                "title": notif["title"],
                "message": notif["message"],
                "isRead": notif.get("isRead", False),
                "createdAt": _isodate(notif.get("createdAt"))
            })
        except Exception:
            continue
    return result


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


@router.post("/notifications/test-push/{user_id}")
async def test_push_notification(user_id: str):
    """Send a test push notification to verify the system works."""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    push_token = user.get("pushToken")
    if not push_token:
        return {"success": False, "error": "No push token registered for this user", "hasToken": False}
    
    result = await send_push_notification(
        push_token,
        "OKC Meets Test",
        "Push notifications are working!",
        {"type": "test"}
    )
    
    return {
        "success": result,
        "hasToken": True,
        "tokenPrefix": push_token[:30] + "...",
        "message": "Push sent successfully!" if result else "Push failed - check server logs"
    }
