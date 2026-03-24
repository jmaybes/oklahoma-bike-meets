from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from bson import ObjectId

from database import db
from models import RSVPCreate, RSVPLegacyCreate
from helpers import send_push_notification, event_helper

router = APIRouter()


# ==================== New RSVP System (/rsvp) ====================

@router.post("/rsvp")
async def create_rsvp(rsvp: RSVPCreate):
    if not ObjectId.is_valid(rsvp.userId):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    user = await db.users.find_one({"_id": ObjectId(rsvp.userId)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Handle recurring event instance IDs
    original_event_id = rsvp.eventId
    instance_date = None
    if "__" in rsvp.eventId:
        parts = rsvp.eventId.split("__")
        original_event_id = parts[0]
        instance_date = parts[1] if len(parts) > 1 else None

    if not ObjectId.is_valid(original_event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")

    event = await db.events.find_one({"_id": ObjectId(original_event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    existing_rsvp = await db.rsvps.find_one({
        "userId": rsvp.userId,
        "eventId": rsvp.eventId
    })

    if existing_rsvp:
        raise HTTPException(status_code=400, detail="Already RSVP'd to this event")

    event_date = event["date"]
    if instance_date:
        try:
            event_date = f"{instance_date[:4]}-{instance_date[4:6]}-{instance_date[6:]}"
        except (IndexError, ValueError):
            pass

    rsvp_data = {
        "userId": rsvp.userId,
        "eventId": rsvp.eventId,
        "eventTitle": event["title"],
        "eventDate": event_date,
        "eventTime": event["time"],
        "eventLocation": event.get("location", ""),
        "reminderSent": False,
        "createdAt": datetime.utcnow().isoformat()
    }

    result = await db.rsvps.insert_one(rsvp_data)

    await db.events.update_one(
        {"_id": ObjectId(original_event_id)},
        {"$inc": {"attendeeCount": 1}}
    )

    notification = {
        "userId": rsvp.userId,
        "type": "rsvp_confirmation",
        "title": f"RSVP Confirmed: {event['title']}",
        "message": f"You're going to {event['title']} on {event_date} at {event['time']}. We'll remind you 24 hours before!",
        "eventId": rsvp.eventId,
        "isRead": False,
        "createdAt": datetime.utcnow().isoformat()
    }
    await db.notifications.insert_one(notification)

    return {
        "id": str(result.inserted_id),
        "message": "RSVP successful! You'll receive a reminder 24 hours before the event.",
        "userId": rsvp_data["userId"],
        "eventId": rsvp_data["eventId"],
        "eventTitle": rsvp_data["eventTitle"],
        "eventDate": rsvp_data["eventDate"],
        "eventTime": rsvp_data["eventTime"],
        "eventLocation": rsvp_data["eventLocation"],
        "reminderSent": rsvp_data["reminderSent"],
        "createdAt": rsvp_data["createdAt"]
    }


@router.delete("/rsvp/{user_id}/{event_id}")
async def cancel_rsvp(user_id: str, event_id: str):
    result = await db.rsvps.delete_one({
        "userId": user_id,
        "eventId": event_id
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="RSVP not found")

    original_event_id = event_id
    if "__" in event_id:
        original_event_id = event_id.split("__")[0]

    if ObjectId.is_valid(original_event_id):
        await db.events.update_one(
            {"_id": ObjectId(original_event_id)},
            {"$inc": {"attendeeCount": -1}}
        )

    return {"message": "RSVP cancelled successfully"}


@router.get("/rsvp/user/{user_id}")
async def get_user_rsvps(user_id: str):
    rsvps = await db.rsvps.find({"userId": user_id}).sort("eventDate", 1).to_list(100)
    return [{
        "id": str(rsvp["_id"]),
        "userId": rsvp["userId"],
        "eventId": rsvp["eventId"],
        "eventTitle": rsvp.get("eventTitle", ""),
        "eventDate": rsvp.get("eventDate", ""),
        "eventTime": rsvp.get("eventTime", ""),
        "eventLocation": rsvp.get("eventLocation", ""),
        "reminderSent": rsvp.get("reminderSent", False),
        "createdAt": rsvp.get("createdAt")
    } for rsvp in rsvps]


@router.get("/rsvp/check/{user_id}/{event_id}")
async def check_rsvp(user_id: str, event_id: str):
    rsvp = await db.rsvps.find_one({
        "userId": user_id,
        "eventId": event_id
    })
    return {"hasRsvp": rsvp is not None}


@router.get("/rsvp/event/{event_id}")
async def get_event_rsvps(event_id: str):
    rsvps = await db.rsvps.find({"eventId": event_id}).to_list(1000)
    return [{
        "id": str(rsvp["_id"]),
        "userId": rsvp["userId"],
        "createdAt": rsvp.get("createdAt")
    } for rsvp in rsvps]


@router.post("/rsvp/send-reminders")
async def send_rsvp_reminders():
    """Send 24-hour reminder notifications (call via cron or scheduler)"""
    from datetime import timedelta

    tomorrow = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")

    rsvps = await db.rsvps.find({
        "eventDate": tomorrow,
        "reminderSent": False
    }).to_list(10000)

    reminders_sent = 0

    for rsvp in rsvps:
        user = await db.users.find_one({"_id": ObjectId(rsvp["userId"])})
        if user and user.get("notificationsEnabled", True):
            notification = {
                "userId": rsvp["userId"],
                "type": "event_reminder",
                "title": f"Reminder: {rsvp['eventTitle']} is Tomorrow!",
                "message": f"Don't forget! {rsvp['eventTitle']} is happening tomorrow at {rsvp['eventTime']} at {rsvp['eventLocation']}",
                "eventId": rsvp["eventId"],
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
                        {"eventId": rsvp["eventId"], "type": "event_reminder"}
                    )
                except Exception as e:
                    print(f"Failed to send push notification: {e}")

            reminders_sent += 1

        await db.rsvps.update_one(
            {"_id": rsvp["_id"]},
            {"$set": {"reminderSent": True}}
        )

    return {"message": f"Sent {reminders_sent} reminder notifications"}


# ==================== Legacy RSVP System (/rsvps) ====================

@router.post("/rsvps")
async def create_rsvp_legacy(rsvp: RSVPLegacyCreate):
    existing = await db.rsvps.find_one({
        "userId": rsvp.userId,
        "eventId": rsvp.eventId
    })

    if existing:
        await db.rsvps.update_one(
            {"_id": existing["_id"]},
            {"$set": {"status": rsvp.status}}
        )
    else:
        rsvp_dict = rsvp.dict()
        rsvp_dict["createdAt"] = datetime.utcnow().isoformat()
        await db.rsvps.insert_one(rsvp_dict)

        if rsvp.status == "going":
            await db.events.update_one(
                {"_id": ObjectId(rsvp.eventId)},
                {"$inc": {"attendeeCount": 1}}
            )

    return {"message": "RSVP updated"}


@router.get("/rsvps/user/{user_id}")
async def get_user_rsvps_legacy(user_id: str):
    rsvps = await db.rsvps.find({"userId": user_id, "status": "going"}).to_list(1000)
    event_ids = [ObjectId(rsvp["eventId"]) for rsvp in rsvps if ObjectId.is_valid(rsvp["eventId"])]

    events = await db.events.find({"_id": {"$in": event_ids}}).to_list(1000)
    return [event_helper(event) for event in events]
