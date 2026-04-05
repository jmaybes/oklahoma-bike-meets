from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import datetime, timedelta
from bson import ObjectId
import os
import base64
import io
import logging

from database import db
from models import EventCreate, EventUpdate, OCRRequest, FavoriteCreate, CommentCreate
from helpers import event_helper, get_ocr_reader, parse_event_details, send_push_notification, _sid
from PIL import Image

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/")
async def root():
    return {"message": "Oklahoma Car Events API"}


@router.post("/events")
async def create_event(event: EventCreate):
    event_dict = event.dict()
    event_dict["createdAt"] = datetime.utcnow().isoformat()

    # Auto-approve all user event submissions
    event_dict["isApproved"] = True

    event_dict["attendeeCount"] = 0

    result = await db.events.insert_one(event_dict)
    created_event = await db.events.find_one({"_id": result.inserted_id})

    # If it's a Pop Up event and approved, create notifications + push for all users
    if event_dict.get("isPopUp") and event_dict.get("isApproved"):
        users = await db.users.find(
            {"notificationsEnabled": {"$ne": False}},
            {"_id": 1, "pushToken": 1, "notificationsEnabled": 1}
        ).to_list(10000)

        notifications = []
        for user in users:
            if str(user["_id"]) != event_dict.get("userId"):
                notification = {
                    "userId": str(user["_id"]),
                    "eventId": str(created_event["_id"]),
                    "type": "popup_event",
                    "title": f"\U0001f6a8 Pop Up Event: {created_event['title']}",
                    "message": f"{created_event['eventType']} happening {created_event['date']} at {created_event['time']} in {created_event['city']}!",
                    "isRead": False,
                    "createdAt": datetime.utcnow().isoformat()
                }
                notifications.append(notification)

                # Send device push notification immediately
                if user.get("pushToken"):
                    try:
                        await send_push_notification(
                            user["pushToken"],
                            notification["title"],
                            notification["message"],
                            {"type": "popup_event", "eventId": str(created_event["_id"])}
                        )
                    except Exception as e:
                        logger.error(f"Failed to send popup push: {e}")

        if notifications:
            await db.notifications.insert_many(notifications)

    return event_helper(created_event)


@router.post("/ocr/scan-flyer")
async def scan_flyer(request: OCRRequest):
    """Scan an event flyer image and extract text to populate event fields."""
    try:
        image_data = request.image
        if ',' in image_data:
            image_data = image_data.split(',')[1]

        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))

        if image.mode != 'RGB':
            image = image.convert('RGB')

        reader = get_ocr_reader()

        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
            image.save(tmp.name, 'JPEG')
            results = reader.readtext(tmp.name)
            os.unlink(tmp.name)

        extracted_text = '\n'.join([text for (bbox, text, confidence) in results])
        parsed_data = parse_event_details(extracted_text)

        return {
            "success": True,
            "extractedText": extracted_text,
            "parsedData": parsed_data
        }

    except Exception as e:
        logger.error(f"OCR error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process image: {str(e)}")


@router.get("/events")
async def get_events(
    city: Optional[str] = Query(None),
    eventType: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    search: Optional[str] = Query(None)
):
    query = {"isApproved": True}

    if city:
        query["city"] = {"$regex": city, "$options": "i"}

    if eventType and eventType != "All":
        query["eventType"] = eventType

    if date:
        query["date"] = date

    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"location": {"$regex": search, "$options": "i"}}
        ]

    events = await db.events.find(query).sort("date", 1).to_list(1000)

    # Generate recurring event instances
    result = []
    today = datetime.utcnow().date()
    weeks_ahead = 12

    for event in events:
        event_data = event_helper(event)

        if event.get("isRecurring") and event.get("recurrenceDay") is not None:
            frontend_day = event.get("recurrenceDay")
            python_weekday = (frontend_day + 6) % 7

            end_date_str = event.get("recurrenceEndDate")
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date() if end_date_str else today + timedelta(weeks=weeks_ahead)

            current_date = today
            days_until_recurrence = (python_weekday - current_date.weekday() + 7) % 7
            if days_until_recurrence == 0:
                next_occurrence = current_date
            else:
                next_occurrence = current_date + timedelta(days=days_until_recurrence)

            while next_occurrence <= end_date:
                instance = event_data.copy()
                instance["date"] = next_occurrence.strftime("%Y-%m-%d")
                instance["id"] = f"{event_data['id']}__{next_occurrence.strftime('%Y%m%d')}"
                instance["parentEventId"] = event_data["id"]
                result.append(instance)
                next_occurrence += timedelta(weeks=1)
        else:
            result.append(event_data)

    result.sort(key=lambda x: str(x.get("date", "")))
    return result


@router.get("/events/user/{user_id}")
async def get_user_events(user_id: str):
    """Get all events created by a specific user (approved or pending)."""
    events = await db.events.find({"userId": user_id}).sort("date", -1).to_list(1000)
    return [event_helper(event) for event in events]




@router.get("/events/{event_id}")
async def get_event(event_id: str):
    instance_date = None
    original_id = event_id
    if "__" in event_id:
        parts = event_id.split("__")
        original_id = parts[0]
        instance_date = parts[1] if len(parts) > 1 else None

    if not ObjectId.is_valid(original_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")

    event = await db.events.find_one({"_id": ObjectId(original_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    result = event_helper(event)

    if instance_date:
        try:
            formatted_date = f"{instance_date[:4]}-{instance_date[4:6]}-{instance_date[6:]}"
            result["date"] = formatted_date
            result["id"] = event_id
            result["parentEventId"] = original_id
        except (IndexError, ValueError):
            pass

    return result


@router.put("/events/{event_id}")
async def update_event(event_id: str, event_update: EventUpdate):
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")

    update_data = {k: v for k, v in event_update.dict().items() if v is not None}

    if update_data:
        await db.events.update_one(
            {"_id": ObjectId(event_id)},
            {"$set": update_data}
        )

    updated_event = await db.events.find_one({"_id": ObjectId(event_id)})
    if not updated_event:
        raise HTTPException(status_code=404, detail="Event not found")

    return event_helper(updated_event)


@router.delete("/events/{event_id}")
async def delete_event(event_id: str):
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")

    result = await db.events.delete_one({"_id": ObjectId(event_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")

    return {"message": "Event deleted successfully"}


# ==================== Favorites ====================

@router.post("/favorites")
async def add_favorite(favorite: FavoriteCreate):
    existing = await db.favorites.find_one({
        "userId": favorite.userId,
        "eventId": favorite.eventId
    })

    if existing:
        return {"message": "Already in favorites"}

    favorite_dict = favorite.dict()
    favorite_dict["createdAt"] = datetime.utcnow().isoformat()

    await db.favorites.insert_one(favorite_dict)
    return {"message": "Added to favorites"}


@router.get("/favorites/user/{user_id}")
async def get_user_favorites(user_id: str):
    favorites = await db.favorites.find({"userId": user_id}).to_list(1000)
    event_ids = [ObjectId(fav["eventId"]) for fav in favorites if ObjectId.is_valid(fav["eventId"])]

    events = await db.events.find({"_id": {"$in": event_ids}}).to_list(1000)
    return [event_helper(event) for event in events]


@router.delete("/favorites/{user_id}/{event_id}")
async def remove_favorite(user_id: str, event_id: str):
    result = await db.favorites.delete_one({
        "userId": user_id,
        "eventId": event_id
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Favorite not found")

    return {"message": "Removed from favorites"}


# ==================== Comments ====================

@router.post("/comments")
async def create_comment(comment: CommentCreate):
    comment_dict = comment.dict()
    comment_dict["createdAt"] = datetime.utcnow().isoformat()

    result = await db.comments.insert_one(comment_dict)
    created_comment = await db.comments.find_one({"_id": result.inserted_id})

    return {
        "id": str(created_comment["_id"]),
        **comment.dict(),
        "createdAt": created_comment["createdAt"]
    }


@router.get("/comments/event/{event_id}")
async def get_event_comments(event_id: str):
    comments = await db.comments.find({"eventId": event_id}).sort("createdAt", -1).to_list(1000)
    return [{
        "id": str(comment["_id"]),
        "eventId": _sid(comment["eventId"]),
        "userId": _sid(comment["userId"]),
        "userName": comment["userName"],
        "text": comment["text"],
        "rating": comment.get("rating"),
        "createdAt": str(comment["createdAt"]) if comment.get("createdAt") else None
    } for comment in comments]
