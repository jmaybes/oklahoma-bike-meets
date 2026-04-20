from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from bson import ObjectId
import os
import base64
import io
import logging

from database import db
from models import EventCreate, EventUpdate, OCRRequest, FavoriteCreate, CommentCreate
from helpers import event_helper, get_ocr_reader, parse_event_details, send_push_notification, _sid, _isodate
from PIL import Image

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/")
async def root():
    return {"message": "Oklahoma Bike Events API"}


@router.post("/events")
async def create_event(event: EventCreate):
    event_dict = event.dict()
    event_dict["createdAt"] = datetime.utcnow().isoformat()

    # Duplicate check: same title + same date = duplicate
    existing = await db.events.find_one({
        "title": {"$regex": f"^{event_dict.get('title', '').strip()}$", "$options": "i"},
        "date": event_dict.get("date", "").split("T")[0]
    })
    if existing:
        logger.info(f"Duplicate event detected: '{event_dict.get('title')}' on {event_dict.get('date')}")
        return event_helper(existing)

    # User-submitted events require admin approval
    event_dict["isApproved"] = False

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
        try:
            event_data = event_helper(event)

            if event.get("isRecurring") and event.get("recurrenceDay") is not None:
                frontend_day = event.get("recurrenceDay")
                python_weekday = (frontend_day + 6) % 7
                recurrence_week = event.get("recurrenceWeek")  # e.g., 1 = first, 2 = second, None = every week

                end_date_str = event.get("recurrenceEndDate")
                end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date() if end_date_str else today + timedelta(weeks=weeks_ahead)

                if recurrence_week:
                    # Nth weekday of each month (e.g., 1st Saturday)
                    from calendar import monthrange
                    current_month = today.replace(day=1)
                    while current_month <= end_date:
                        # Find the nth occurrence of the weekday in this month
                        day = 1
                        count = 0
                        days_in_month = monthrange(current_month.year, current_month.month)[1]
                        found_date = None
                        while day <= days_in_month:
                            d = current_month.replace(day=day)
                            if d.weekday() == python_weekday:
                                count += 1
                                if count == recurrence_week:
                                    found_date = d
                                    break
                            day += 1
                        if found_date and found_date >= today and found_date <= end_date:
                            instance = event_data.copy()
                            instance["date"] = found_date.strftime("%Y-%m-%d")
                            instance["id"] = f"{event_data['id']}__{found_date.strftime('%Y%m%d')}"
                            instance["parentEventId"] = event_data["id"]
                            result.append(instance)
                        # Move to next month
                        if current_month.month == 12:
                            current_month = current_month.replace(year=current_month.year + 1, month=1)
                        else:
                            current_month = current_month.replace(month=current_month.month + 1)
                else:
                    # Every week
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
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Skipping broken event {event.get('_id')}: {e}")
            continue

    result.sort(key=lambda x: str(x.get("date", "")))
    return result


@router.get("/events/user/{user_id}")
async def get_user_events(user_id: str):
    """Get all events created by a specific user (approved or pending)."""
    events = await db.events.find({"userId": user_id}).sort("date", -1).to_list(1000)
    result = []
    for event in events:
        try:
            result.append(event_helper(event))
        except Exception:
            continue
    return result




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
    result = []
    for event in events:
        try:
            result.append(event_helper(event))
        except Exception:
            continue
    return result


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
        "createdAt": _isodate(comment.get("createdAt"))
    } for comment in comments]


# ─── Facebook Post Import (Apify Integration) ───

class FacebookPostImport(BaseModel):
    posts: list  # Array of Apify scraped post objects

@router.post("/events/import-facebook-posts")
async def import_facebook_posts(data: FacebookPostImport):
    """
    Accept Apify-scraped Facebook group posts, use GPT to identify
    bike events, and create them in the database (pending admin approval).
    Uses the standard OpenAI Python SDK (AsyncOpenAI) for VPS compatibility.
    """
    try:
        from openai import AsyncOpenAI
        import json

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="OpenAI API key not configured")

        client = AsyncOpenAI(api_key=api_key)

        posts = data.posts
        if not posts:
            return {"message": "No posts provided", "eventsCreated": 0, "eventsSkipped": 0}

        # Combine all post texts into batches for efficiency
        post_texts = []
        for p in posts:
            text = p.get("text") or p.get("message") or p.get("postText") or ""
            group = p.get("groupName") or p.get("group_name") or "Unknown Group"
            url = p.get("url") or p.get("postUrl") or ""
            timestamp = p.get("timestamp") or p.get("time") or p.get("date") or ""
            if text.strip():
                post_texts.append(f"[Group: {group} | Posted: {timestamp} | URL: {url}]\n{text}")

        if not post_texts:
            return {"message": "No text content found in posts", "eventsCreated": 0, "eventsSkipped": 0}

        system_message = """You are an expert at identifying bike event announcements in Facebook group posts.
Analyze each post and determine if it's announcing a car-related event (bike show, bike meet, cruise, drag race, swap meet, etc.).

IGNORE posts that are:
- Just showing off someone's car
- Selling car parts
- General discussion/questions
- Memes or photos without event info

For each REAL EVENT found, extract:
- title: Event name
- description: Brief description (2-3 sentences)
- date: Date in YYYY-MM-DD format. If a post says "this Saturday" or relative dates, estimate based on the post timestamp. Use 2026 for upcoming events.
- time: Start time (e.g., "8:00 AM"). Use "TBD" if not mentioned.
- location: Venue name
- address: Full address if available, otherwise city and state
- city: City name
- eventType: One of: Car Show, Car Meet, Car Cruise, Drag Race, Swap Meet, Auction, Other
- entryFee: Entry fee (e.g., "Free", "$20", "TBD")
- organizer: Organizing group/person if mentioned
- website: URL if mentioned
- carTypes: Array of car types (e.g., ["All"], ["Classic", "Muscle"])
- sourceUrl: The Facebook post URL if available

IMPORTANT:
- Focus on Oklahoma events, but include nearby states if clearly bike events
- Return ONLY a valid JSON array of event objects
- If NO events found in any posts, return []
- Do NOT fabricate events - only extract what's clearly announced"""

        # Process in batches of 10 posts to stay within token limits
        all_events = []
        batch_size = 10
        for i in range(0, len(post_texts), batch_size):
            batch = post_texts[i:i + batch_size]
            combined_text = "\n\n---POST SEPARATOR---\n\n".join(batch)

            prompt = f"""Analyze these Facebook group posts and extract any bike event announcements:

{combined_text[:12000]}

Return ONLY a valid JSON array of events found. Return [] if none."""

            response = await client.chat.completions.create(
                model="gpt-4.1",
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
            )

            response_text = response.choices[0].message.content.strip()
            if response_text.startswith("```"):
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
            response_text = response_text.strip()

            # Find JSON array in response
            start_idx = response_text.find('[')
            end_idx = response_text.rfind(']') + 1

            try:
                if start_idx != -1 and end_idx > start_idx:
                    json_str = response_text[start_idx:end_idx]
                    parsed_events = json.loads(json_str)
                    if isinstance(parsed_events, list):
                        all_events.extend(parsed_events)
                else:
                    logger.warning(f"No JSON array found in batch {i}")
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse GPT response for batch {i}: {response_text[:200]}")
                continue

        # Insert events, checking for duplicates
        created = 0
        skipped = 0
        created_events = []

        for ev in all_events:
            title = ev.get("title", "").strip()
            if not title:
                skipped += 1
                continue

            # Check for duplicates by similar title
            existing = await db.events.find_one({
                "title": {"$regex": f"^{title}$", "$options": "i"}
            })
            if existing:
                skipped += 1
                continue

            event_doc = {
                "title": title,
                "description": ev.get("description", ""),
                "date": ev.get("date", "TBD"),
                "time": ev.get("time", "TBD"),
                "location": ev.get("location", ""),
                "address": ev.get("address", ""),
                "city": ev.get("city", "Oklahoma City"),
                "eventType": ev.get("eventType", "Bike Meet"),
                "entryFee": ev.get("entryFee", "TBD"),
                "organizer": ev.get("organizer", ""),
                "website": ev.get("website", ""),
                "carTypes": ev.get("carTypes", ["All"]),
                "source": "facebook",
                "sourceUrl": ev.get("sourceUrl", ""),
                "isApproved": False,
                "attendeeCount": 0,
                "createdAt": datetime.utcnow().isoformat(),
                "discoveredAt": datetime.utcnow().isoformat(),
                "photos": [],
            }

            result = await db.events.insert_one(event_doc)
            event_doc["id"] = str(result.inserted_id)
            created_events.append({"id": event_doc["id"], "title": title, "date": ev.get("date", "TBD")})
            created += 1

        return {
            "message": f"Import complete. {created} events created, {skipped} skipped (duplicates or empty).",
            "eventsCreated": created,
            "eventsSkipped": skipped,
            "events": created_events,
            "totalPostsAnalyzed": len(post_texts),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Facebook import error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
