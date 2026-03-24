from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import datetime
from bson import ObjectId

from database import db
from models import FeedbackCreate
from helpers import feedback_helper, send_push_notification

router = APIRouter()


@router.post("/feedback")
async def submit_feedback(feedback: FeedbackCreate):
    """Submit a bug report, suggestion, or other feedback"""
    feedback_dict = feedback.dict()
    feedback_dict["status"] = "new"
    feedback_dict["createdAt"] = datetime.utcnow().isoformat()

    result = await db.feedback.insert_one(feedback_dict)
    created_feedback = await db.feedback.find_one({"_id": result.inserted_id})

    # Notify all admins about new feedback
    admins = await db.users.find({"isAdmin": True}).to_list(100)
    notifications = []

    type_label = {
        "bug": "Bug Report",
        "suggestion": "Suggestion",
        "other": "Feedback"
    }.get(feedback.type, "Feedback")

    for admin in admins:
        notification = {
            "userId": str(admin["_id"]),
            "type": "admin_feedback",
            "title": f"New {type_label} from {feedback.userName}",
            "message": f"{feedback.subject}: {feedback.message[:100]}...",
            "feedbackId": str(result.inserted_id),
            "isRead": False,
            "createdAt": datetime.utcnow().isoformat()
        }
        notifications.append(notification)

        if admin.get("pushToken"):
            try:
                await send_push_notification(
                    admin["pushToken"],
                    notification["title"],
                    notification["message"],
                    {"type": "admin_feedback", "feedbackId": str(result.inserted_id)}
                )
            except Exception as e:
                print(f"Failed to send push notification to admin: {e}")

    if notifications:
        await db.notifications.insert_many(notifications)

    return feedback_helper(created_feedback)


@router.get("/feedback/user/{user_id}")
async def get_user_feedback(user_id: str):
    """Get all feedback submitted by a user"""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    feedback_list = await db.feedback.find({"userId": user_id}).sort("createdAt", -1).to_list(100)
    return [feedback_helper(f) for f in feedback_list]


@router.get("/feedback/admin")
async def get_all_feedback(status: Optional[str] = None):
    """Get all feedback (admin only)"""
    query = {}
    if status:
        query["status"] = status

    feedback_list = await db.feedback.find(query).sort("createdAt", -1).to_list(1000)
    return [feedback_helper(f) for f in feedback_list]


@router.put("/feedback/{feedback_id}/respond")
async def respond_to_feedback(feedback_id: str, response: str = Query(...), status: str = Query("in_progress")):
    """Admin response to feedback"""
    if not ObjectId.is_valid(feedback_id):
        raise HTTPException(status_code=400, detail="Invalid feedback ID")

    await db.feedback.update_one(
        {"_id": ObjectId(feedback_id)},
        {"$set": {
            "adminResponse": response,
            "status": status,
            "updatedAt": datetime.utcnow().isoformat()
        }}
    )

    feedback = await db.feedback.find_one({"_id": ObjectId(feedback_id)})
    if feedback and feedback.get("userId"):
        user_id = feedback["userId"]
        if ObjectId.is_valid(user_id):
            user = await db.users.find_one({"_id": ObjectId(user_id)})
            if user:
                notification = {
                    "userId": user_id,
                    "type": "feedback_response",
                    "title": "Response to your feedback",
                    "message": f"Admin responded: {response[:100]}...",
                    "feedbackId": feedback_id,
                    "isRead": False,
                    "createdAt": datetime.utcnow().isoformat()
                }
                await db.notifications.insert_one(notification)

                if user.get("pushToken"):
                    try:
                        await send_push_notification(
                            user["pushToken"],
                            notification["title"],
                            notification["message"],
                            {"type": "feedback_response", "feedbackId": feedback_id}
                        )
                    except Exception as e:
                        print(f"Failed to send push notification: {e}")

    updated_feedback = await db.feedback.find_one({"_id": ObjectId(feedback_id)})
    return feedback_helper(updated_feedback)


@router.put("/feedback/{feedback_id}/status")
async def update_feedback_status(feedback_id: str, status: str = Query(...)):
    """Update feedback status"""
    if not ObjectId.is_valid(feedback_id):
        raise HTTPException(status_code=400, detail="Invalid feedback ID")

    valid_statuses = ["new", "in_progress", "resolved", "closed"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    await db.feedback.update_one(
        {"_id": ObjectId(feedback_id)},
        {"$set": {
            "status": status,
            "updatedAt": datetime.utcnow().isoformat()
        }}
    )

    updated_feedback = await db.feedback.find_one({"_id": ObjectId(feedback_id)})
    return feedback_helper(updated_feedback)
