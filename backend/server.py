from fastapi import FastAPI, APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
import base64
import io
import json
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime
from bson import ObjectId
import httpx
from PIL import Image

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Initialize EasyOCR reader (lazy loading)
ocr_reader = None

def get_ocr_reader():
    global ocr_reader
    if ocr_reader is None:
        import easyocr
        ocr_reader = easyocr.Reader(['en'], gpu=False)
    return ocr_reader

def parse_event_details(text: str) -> dict:
    """Parse extracted text to identify event details"""
    lines = text.split('\n')
    full_text = ' '.join(lines)
    
    result = {
        "title": "",
        "description": "",
        "date": "",
        "time": "",
        "location": "",
        "address": "",
        "rawText": text
    }
    
    # Try to find date patterns (various formats)
    date_patterns = [
        r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',  # 01/15/2025 or 1-15-25
        r'((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})',  # January 15, 2025
        r'((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?)',  # January 15
        r'(\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)',  # 15th of January
    ]
    
    for pattern in date_patterns:
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            result["date"] = match.group(1)
            break
    
    # Try to find time patterns
    time_patterns = [
        r'(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)',  # 7:00 PM
        r'(\d{1,2}\s*(?:AM|PM|am|pm))',  # 7 PM
        r'(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)',  # 7:00 - 9:00 PM
    ]
    
    for pattern in time_patterns:
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            result["time"] = match.group(1)
            break
    
    # Try to find location/address patterns
    address_patterns = [
        r'(\d+\s+[A-Za-z\s]+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Way|Pkwy|Parkway)[.,]?\s*(?:[A-Za-z\s]+,?\s*)?(?:OK|Oklahoma)?(?:\s*\d{5})?)',
        r'((?:at|@|location:?)\s*[A-Za-z0-9\s\'\-]+)',
    ]
    
    for pattern in address_patterns:
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            result["address"] = match.group(1).strip()
            break
    
    # Try to identify title (usually the largest/first prominent text)
    # Use the first line that looks like a title (not a date/time/address)
    for line in lines:
        line = line.strip()
        if len(line) > 3 and len(line) < 60:
            # Skip if it looks like a date, time, or address
            if not re.search(r'\d{1,2}[/-]\d{1,2}', line) and \
               not re.search(r'\d{1,2}:\d{2}', line) and \
               not re.search(r'(?:AM|PM)', line, re.IGNORECASE):
                result["title"] = line
                break
    
    # Rest of the text becomes description
    desc_lines = [l.strip() for l in lines if l.strip() and l.strip() != result["title"]]
    result["description"] = '\n'.join(desc_lines[:5])  # First 5 lines as description
    
    return result

# Expo Push Notification helper
async def send_push_notification(push_token: str, title: str, body: str, data: dict = None):
    """Send push notification via Expo's push service"""
    if not push_token or not push_token.startswith('ExponentPushToken'):
        return False
    
    message = {
        "to": push_token,
        "sound": "default",
        "title": title,
        "body": body,
        "data": data or {}
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json=message,
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }
            )
            return response.status_code == 200
    except Exception as e:
        logging.error(f"Failed to send push notification: {e}")
        return False

# Helper function to convert ObjectId to string
def event_helper(event) -> dict:
    return {
        "id": str(event["_id"]),
        "title": event["title"],
        "description": event["description"],
        "date": event["date"],
        "time": event["time"],
        "location": event["location"],
        "address": event["address"],
        "city": event["city"],
        "latitude": event.get("latitude"),
        "longitude": event.get("longitude"),
        "organizer": event.get("organizer", ""),
        "entryFee": event.get("entryFee", ""),
        "carTypes": event.get("carTypes", []),
        "eventType": event.get("eventType", "Car Meet"),
        "photos": event.get("photos", []),
        "attendeeCount": event.get("attendeeCount", 0),
        "userId": event.get("userId"),
        "isApproved": event.get("isApproved", True),
        "isPopUp": event.get("isPopUp", False),
        "createdAt": event.get("createdAt"),
        "contactInfo": event.get("contactInfo", ""),
        "website": event.get("website", ""),
    }

def user_helper(user) -> dict:
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user["name"],
        "nickname": user.get("nickname", ""),
        "profilePic": user.get("profilePic", ""),
        "isAdmin": user.get("isAdmin", False),
        "notificationsEnabled": user.get("notificationsEnabled", True),
        "locationSharingEnabled": user.get("locationSharingEnabled", True),
        "locationPrivate": user.get("locationPrivate", False),
        "latitude": user.get("latitude"),
        "longitude": user.get("longitude"),
        "pushToken": user.get("pushToken", ""),
        "createdAt": user["createdAt"],
    }

# Define Models
class EventCreate(BaseModel):
    title: str
    description: str
    date: str
    time: str
    location: str
    address: str
    city: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    organizer: str = ""
    entryFee: str = ""
    carTypes: List[str] = []
    eventType: str = "Car Meet"
    photos: List[str] = []
    userId: Optional[str] = None
    contactInfo: str = ""
    website: str = ""
    isPopUp: bool = False

class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    location: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    organizer: Optional[str] = None
    entryFee: Optional[str] = None
    carTypes: Optional[List[str]] = None
    eventType: Optional[str] = None
    photos: Optional[List[str]] = None
    contactInfo: Optional[str] = None
    website: Optional[str] = None

class UserCreate(BaseModel):
    email: str
    name: str
    password: str
    nickname: str = ""
    profilePic: str = ""
    isAdmin: bool = False
    notificationsEnabled: bool = True
    locationSharingEnabled: bool = True

class UserUpdate(BaseModel):
    name: Optional[str] = None
    nickname: Optional[str] = None
    profilePic: Optional[str] = None
    notificationsEnabled: Optional[bool] = None
    locationSharingEnabled: Optional[bool] = None
    locationPrivate: Optional[bool] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    pushToken: Optional[str] = None

class Modification(BaseModel):
    category: str  # e.g., "Engine", "Suspension", "Exterior", "Interior", "Wheels"
    name: str
    brand: Optional[str] = None
    description: Optional[str] = None
    cost: Optional[float] = None

class UserCarCreate(BaseModel):
    userId: str
    make: str
    model: str
    year: str
    color: str = ""
    trim: str = ""
    engine: str = ""
    horsepower: Optional[int] = None
    torque: Optional[int] = None
    transmission: str = ""
    drivetrain: str = ""  # FWD, RWD, AWD
    description: str = ""
    photos: List[str] = []
    videos: List[str] = []  # Base64 encoded or URLs
    modifications: List[Modification] = []
    modificationNotes: str = ""  # Free-form text for additional notes
    isPublic: bool = True  # Default to public/sharing mode
    instagramHandle: str = ""
    youtubeChannel: str = ""

class UserCarUpdate(BaseModel):
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[str] = None
    color: Optional[str] = None
    trim: Optional[str] = None
    engine: Optional[str] = None
    horsepower: Optional[int] = None
    torque: Optional[int] = None
    transmission: Optional[str] = None
    drivetrain: Optional[str] = None
    description: Optional[str] = None
    photos: Optional[List[str]] = None
    videos: Optional[List[str]] = None
    modifications: Optional[List[Modification]] = None
    modificationNotes: Optional[str] = None
    isPublic: Optional[bool] = None
    instagramHandle: Optional[str] = None
    youtubeChannel: Optional[str] = None

class MessageCreate(BaseModel):
    senderId: str
    recipientId: str
    content: str

class LocationUpdate(BaseModel):
    userId: str
    latitude: float
    longitude: float
    isSharing: bool = True
    shareUntil: Optional[str] = None

class PerformanceRunCreate(BaseModel):
    userId: str
    carInfo: str
    zeroToSixty: Optional[float] = None
    zeroToHundred: Optional[float] = None
    quarterMile: Optional[float] = None
    location: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class OCRRequest(BaseModel):
    image: str  # Base64 encoded image

class RSVPCreate(BaseModel):
    userId: str
    eventId: str

class UserLogin(BaseModel):
    email: str
    password: str

class FavoriteCreate(BaseModel):
    userId: str
    eventId: str

class RSVPCreate(BaseModel):
    userId: str
    eventId: str
    status: str = "going"

class CommentCreate(BaseModel):
    eventId: str
    userId: str
    userName: str
    text: str
    rating: Optional[int] = None

class ClubCreate(BaseModel):
    name: str
    description: str
    location: str
    city: str
    carTypes: List[str] = []

class FeedbackCreate(BaseModel):
    userId: str
    userName: str
    userEmail: str
    type: str  # "bug", "suggestion", "other"
    subject: str
    message: str

class FeedbackResponse(BaseModel):
    id: str
    userId: str
    userName: str
    userEmail: str
    type: str
    subject: str
    message: str
    status: str  # "new", "in_progress", "resolved", "closed"
    adminResponse: Optional[str] = None
    createdAt: str
    updatedAt: Optional[str] = None

# Route Planning Models
class Waypoint(BaseModel):
    latitude: float
    longitude: float
    name: Optional[str] = None
    order: int

class RouteCreate(BaseModel):
    userId: str
    userName: str
    name: str
    description: str
    waypoints: List[Waypoint]
    distance: Optional[float] = None  # in miles
    estimatedTime: Optional[str] = None  # e.g., "2h 30m"
    scenicHighlights: List[str] = []  # e.g., ["Lake view", "Mountain pass"]
    difficulty: str = "easy"  # easy, moderate, challenging
    isPublic: bool = True

class RouteUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    waypoints: Optional[List[Waypoint]] = None
    distance: Optional[float] = None
    estimatedTime: Optional[str] = None
    scenicHighlights: Optional[List[str]] = None
    difficulty: Optional[str] = None
    isPublic: Optional[bool] = None
    contactInfo: str = ""
    website: str = ""
    facebookGroup: str = ""
    meetingSchedule: str = ""
    memberCount: str = ""
    userId: Optional[str] = None

# Event Routes
@api_router.get("/")
async def root():
    return {"message": "Oklahoma Car Events API"}

@api_router.post("/events")
async def create_event(event: EventCreate):
    event_dict = event.dict()
    event_dict["createdAt"] = datetime.utcnow().isoformat()
    
    # If userId is provided, check if user is admin
    if event_dict.get("userId"):
        user = await db.users.find_one({"_id": ObjectId(event_dict["userId"])})
        event_dict["isApproved"] = user.get("isAdmin", False) if user else False
    else:
        # Guest submissions require approval
        event_dict["isApproved"] = False
    
    event_dict["attendeeCount"] = 0
    
    result = await db.events.insert_one(event_dict)
    created_event = await db.events.find_one({"_id": result.inserted_id})
    
    # If it's a Pop Up event and approved, create notifications for all users
    if event_dict.get("isPopUp") and event_dict.get("isApproved"):
        # Get all users with notifications enabled
        users = await db.users.find({"notificationsEnabled": {"$ne": False}}).to_list(10000)
        
        # Create notifications
        notifications = []
        for user in users:
            if str(user["_id"]) != event_dict.get("userId"):  # Don't notify creator
                notification = {
                    "userId": str(user["_id"]),
                    "eventId": str(created_event["_id"]),
                    "type": "popup_event",
                    "title": f"🚨 Pop Up Event: {created_event['title']}",
                    "message": f"{created_event['eventType']} happening {created_event['date']} at {created_event['time']} in {created_event['city']}!",
                    "isRead": False,
                    "createdAt": datetime.utcnow().isoformat()
                }
                notifications.append(notification)
        
        if notifications:
            await db.notifications.insert_many(notifications)
    
    return event_helper(created_event)

# OCR Endpoint for scanning flyers
@api_router.post("/ocr/scan-flyer")
async def scan_flyer(request: OCRRequest):
    """
    Scan an event flyer image and extract text to populate event fields.
    Accepts a base64 encoded image.
    """
    try:
        # Remove data URL prefix if present
        image_data = request.image
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        # Decode base64 image
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Get OCR reader and perform text extraction
        reader = get_ocr_reader()
        
        # Save image temporarily for OCR
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
            image.save(tmp.name, 'JPEG')
            results = reader.readtext(tmp.name)
            os.unlink(tmp.name)
        
        # Combine all detected text
        extracted_text = '\n'.join([text for (bbox, text, confidence) in results])
        
        # Parse the extracted text to identify event details
        parsed_data = parse_event_details(extracted_text)
        
        return {
            "success": True,
            "extractedText": extracted_text,
            "parsedData": parsed_data
        }
        
    except Exception as e:
        logging.error(f"OCR error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process image: {str(e)}")

@api_router.get("/events")
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
    return [event_helper(event) for event in events]

@api_router.get("/events/{event_id}")
async def get_event(event_id: str):
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")
    
    event = await db.events.find_one({"_id": ObjectId(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    return event_helper(event)

@api_router.put("/events/{event_id}")
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

@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str):
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")
    
    result = await db.events.delete_one({"_id": ObjectId(event_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    
    return {"message": "Event deleted successfully"}

# RSVP Routes
@api_router.post("/rsvp")
async def create_rsvp(rsvp: RSVPCreate):
    # Check if user exists
    if not ObjectId.is_valid(rsvp.userId):
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    user = await db.users.find_one({"_id": ObjectId(rsvp.userId)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if event exists
    if not ObjectId.is_valid(rsvp.eventId):
        raise HTTPException(status_code=400, detail="Invalid event ID")
    
    event = await db.events.find_one({"_id": ObjectId(rsvp.eventId)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check if already RSVP'd
    existing_rsvp = await db.rsvps.find_one({
        "userId": rsvp.userId,
        "eventId": rsvp.eventId
    })
    
    if existing_rsvp:
        raise HTTPException(status_code=400, detail="Already RSVP'd to this event")
    
    # Create RSVP
    rsvp_data = {
        "userId": rsvp.userId,
        "eventId": rsvp.eventId,
        "eventTitle": event["title"],
        "eventDate": event["date"],
        "eventTime": event["time"],
        "eventLocation": event.get("location", ""),
        "reminderSent": False,
        "createdAt": datetime.utcnow().isoformat()
    }
    
    result = await db.rsvps.insert_one(rsvp_data)
    
    # Increment attendee count on event
    await db.events.update_one(
        {"_id": ObjectId(rsvp.eventId)},
        {"$inc": {"attendeeCount": 1}}
    )
    
    # Create a notification for successful RSVP
    notification = {
        "userId": rsvp.userId,
        "type": "rsvp_confirmation",
        "title": f"RSVP Confirmed: {event['title']}",
        "message": f"You're going to {event['title']} on {event['date']} at {event['time']}. We'll remind you 24 hours before!",
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

@api_router.delete("/rsvp/{user_id}/{event_id}")
async def cancel_rsvp(user_id: str, event_id: str):
    result = await db.rsvps.delete_one({
        "userId": user_id,
        "eventId": event_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="RSVP not found")
    
    # Decrement attendee count
    await db.events.update_one(
        {"_id": ObjectId(event_id)},
        {"$inc": {"attendeeCount": -1}}
    )
    
    return {"message": "RSVP cancelled successfully"}

@api_router.get("/rsvp/user/{user_id}")
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

@api_router.get("/rsvp/check/{user_id}/{event_id}")
async def check_rsvp(user_id: str, event_id: str):
    rsvp = await db.rsvps.find_one({
        "userId": user_id,
        "eventId": event_id
    })
    return {"hasRsvp": rsvp is not None}

@api_router.get("/rsvp/event/{event_id}")
async def get_event_rsvps(event_id: str):
    rsvps = await db.rsvps.find({"eventId": event_id}).to_list(1000)
    return [{
        "id": str(rsvp["_id"]),
        "userId": rsvp["userId"],
        "createdAt": rsvp.get("createdAt")
    } for rsvp in rsvps]

# Send 24-hour reminder notifications (call this endpoint via cron or scheduler)
@api_router.post("/rsvp/send-reminders")
async def send_rsvp_reminders():
    from datetime import timedelta
    
    # Get tomorrow's date
    tomorrow = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
    
    # Find all RSVPs for events happening tomorrow that haven't been reminded
    rsvps = await db.rsvps.find({
        "eventDate": tomorrow,
        "reminderSent": False
    }).to_list(10000)
    
    reminders_sent = 0
    
    for rsvp in rsvps:
        # Check if user has notifications enabled
        user = await db.users.find_one({"_id": ObjectId(rsvp["userId"])})
        if user and user.get("notificationsEnabled", True):
            # Create reminder notification in DB
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
            
            # Send push notification if user has a push token
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
        
        # Mark reminder as sent
        await db.rsvps.update_one(
            {"_id": rsvp["_id"]},
            {"$set": {"reminderSent": True}}
        )
    
    return {"message": f"Sent {reminders_sent} reminder notifications"}

# Get user notifications
@api_router.get("/notifications/{user_id}")
async def get_user_notifications(user_id: str):
    notifications = await db.notifications.find({"userId": user_id}).sort("createdAt", -1).to_list(50)
    return [{
        "id": str(n["_id"]),
        "userId": n["userId"],
        "type": n.get("type", "general"),
        "title": n["title"],
        "message": n["message"],
        "eventId": n.get("eventId"),
        "isRead": n.get("isRead", False),
        "createdAt": n.get("createdAt")
    } for n in notifications]

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(status_code=400, detail="Invalid notification ID")
    
    await db.notifications.update_one(
        {"_id": ObjectId(notification_id)},
        {"$set": {"isRead": True}}
    )
    return {"message": "Notification marked as read"}

# ==================== NEARBY USERS & MEETUP INVITES ====================

import math

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in miles using Haversine formula"""
    R = 3959  # Earth's radius in miles
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

@api_router.get("/users/nearby/{user_id}")
async def get_nearby_users(
    user_id: str,
    latitude: float = Query(...),
    longitude: float = Query(...),
    radius: float = Query(default=25, le=50)  # Max 50 miles
):
    """Get all users within specified radius who have location sharing enabled and are not private"""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    # Update requesting user's location
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"latitude": latitude, "longitude": longitude}}
    )
    
    # Find all users with location sharing enabled and not private
    users = await db.users.find({
        "locationSharingEnabled": {"$ne": False},
        "locationPrivate": {"$ne": True},
        "latitude": {"$exists": True, "$ne": None},
        "longitude": {"$exists": True, "$ne": None},
        "_id": {"$ne": ObjectId(user_id)}  # Exclude self
    }).to_list(10000)
    
    nearby_users = []
    for user in users:
        distance = haversine_distance(
            latitude, longitude,
            user["latitude"], user["longitude"]
        )
        if distance <= radius:
            nearby_users.append({
                "id": str(user["_id"]),
                "name": user.get("name", ""),
                "nickname": user.get("nickname", ""),
                "profilePic": user.get("profilePic", ""),
                "latitude": user["latitude"],
                "longitude": user["longitude"],
                "distance": round(distance, 1)
            })
    
    # Sort by distance
    nearby_users.sort(key=lambda x: x["distance"])
    
    return {
        "count": len(nearby_users),
        "radius": radius,
        "users": nearby_users
    }

class MeetupInviteRequest(BaseModel):
    senderId: str
    senderName: str
    senderLatitude: float
    senderLongitude: float
    radius: float
    message: str
    isCustomMessage: bool = False

# Prewritten invite messages
PREWRITTEN_INVITES = [
    "Hey car enthusiasts! I'm nearby and looking to meet up. Anyone want to cruise?",
    "Pop-up meet happening now! Come check out some rides in the area!",
    "Looking for fellow car lovers to hang out. Who's around?",
    "Spontaneous car meet! Drop your location if you're interested!",
    "Any gearheads nearby want to link up and talk cars?"
]

@api_router.get("/meetup/prewritten-messages")
async def get_prewritten_messages():
    """Get list of prewritten meetup invite messages"""
    return {"messages": PREWRITTEN_INVITES}

@api_router.post("/meetup/send-invite")
async def send_meetup_invite(invite: MeetupInviteRequest):
    """Send meetup invite to all users within specified radius"""
    if not ObjectId.is_valid(invite.senderId):
        raise HTTPException(status_code=400, detail="Invalid sender ID")
    
    # Get sender info
    sender = await db.users.find_one({"_id": ObjectId(invite.senderId)})
    if not sender:
        raise HTTPException(status_code=404, detail="Sender not found")
    
    # Find all users within radius
    users = await db.users.find({
        "locationSharingEnabled": {"$ne": False},
        "notificationsEnabled": {"$ne": False},
        "latitude": {"$exists": True, "$ne": None},
        "longitude": {"$exists": True, "$ne": None},
        "_id": {"$ne": ObjectId(invite.senderId)}
    }).to_list(10000)
    
    invites_sent = 0
    notifications = []
    
    for user in users:
        distance = haversine_distance(
            invite.senderLatitude, invite.senderLongitude,
            user["latitude"], user["longitude"]
        )
        
        if distance <= invite.radius:
            # Create notification
            notification = {
                "userId": str(user["_id"]),
                "type": "meetup_invite",
                "title": f"🚗 Meetup Invite from {invite.senderName}!",
                "message": invite.message,
                "senderId": invite.senderId,
                "senderName": invite.senderName,
                "senderLatitude": invite.senderLatitude,
                "senderLongitude": invite.senderLongitude,
                "distance": round(distance, 1),
                "isRead": False,
                "createdAt": datetime.utcnow().isoformat()
            }
            notifications.append(notification)
            
            # Send push notification if user has token
            if user.get("pushToken"):
                try:
                    await send_push_notification(
                        user["pushToken"],
                        notification["title"],
                        f"{invite.message} ({round(distance, 1)} miles away)",
                        {
                            "type": "meetup_invite",
                            "senderId": invite.senderId,
                            "senderLatitude": invite.senderLatitude,
                            "senderLongitude": invite.senderLongitude
                        }
                    )
                except Exception as e:
                    print(f"Failed to send push notification: {e}")
            
            invites_sent += 1
    
    # Bulk insert notifications
    if notifications:
        await db.notifications.insert_many(notifications)
    
    return {
        "message": f"Meetup invite sent to {invites_sent} nearby users",
        "invitesSent": invites_sent,
        "radius": invite.radius
    }

# ==================== FEEDBACK & BUG REPORTS ====================

def feedback_helper(feedback) -> dict:
    return {
        "id": str(feedback["_id"]),
        "userId": feedback["userId"],
        "userName": feedback["userName"],
        "userEmail": feedback["userEmail"],
        "type": feedback["type"],
        "subject": feedback["subject"],
        "message": feedback["message"],
        "status": feedback.get("status", "new"),
        "adminResponse": feedback.get("adminResponse"),
        "createdAt": feedback["createdAt"],
        "updatedAt": feedback.get("updatedAt"),
    }

@api_router.post("/feedback")
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
        
        # Send push notification to admin
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

@api_router.get("/feedback/user/{user_id}")
async def get_user_feedback(user_id: str):
    """Get all feedback submitted by a user"""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    feedback_list = await db.feedback.find({"userId": user_id}).sort("createdAt", -1).to_list(100)
    return [feedback_helper(f) for f in feedback_list]

@api_router.get("/feedback/admin")
async def get_all_feedback(status: Optional[str] = None):
    """Get all feedback (admin only)"""
    query = {}
    if status:
        query["status"] = status
    
    feedback_list = await db.feedback.find(query).sort("createdAt", -1).to_list(1000)
    return [feedback_helper(f) for f in feedback_list]

@api_router.put("/feedback/{feedback_id}/respond")
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
    
    # Notify user about response
    feedback = await db.feedback.find_one({"_id": ObjectId(feedback_id)})
    if feedback:
        user = await db.users.find_one({"_id": ObjectId(feedback["userId"])})
        if user:
            notification = {
                "userId": feedback["userId"],
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

@api_router.put("/feedback/{feedback_id}/status")
async def update_feedback_status(feedback_id: str, status: str = Query(...)):
    """Update feedback status (new, in_progress, resolved, closed)"""
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

# ==================== ROUTE PLANNING & SHARING ====================

def route_helper(route) -> dict:
    return {
        "id": str(route["_id"]),
        "userId": route["userId"],
        "userName": route["userName"],
        "name": route["name"],
        "description": route["description"],
        "waypoints": route["waypoints"],
        "distance": route.get("distance"),
        "estimatedTime": route.get("estimatedTime"),
        "scenicHighlights": route.get("scenicHighlights", []),
        "difficulty": route.get("difficulty", "easy"),
        "isPublic": route.get("isPublic", True),
        "likes": route.get("likes", 0),
        "savedBy": route.get("savedBy", []),
        "createdAt": route["createdAt"],
        "updatedAt": route.get("updatedAt"),
    }

@api_router.post("/routes")
async def create_route(route: RouteCreate):
    """Create a new driving route"""
    route_dict = route.dict()
    route_dict["likes"] = 0
    route_dict["savedBy"] = []
    route_dict["createdAt"] = datetime.utcnow().isoformat()
    
    result = await db.routes.insert_one(route_dict)
    created_route = await db.routes.find_one({"_id": result.inserted_id})
    return route_helper(created_route)

@api_router.get("/routes")
async def get_public_routes(
    difficulty: Optional[str] = None,
    limit: int = Query(default=50, le=100)
):
    """Get all public routes"""
    query = {"isPublic": True}
    if difficulty:
        query["difficulty"] = difficulty
    
    routes = await db.routes.find(query).sort("createdAt", -1).limit(limit).to_list(limit)
    return [route_helper(r) for r in routes]

@api_router.get("/routes/user/{user_id}")
async def get_user_routes(user_id: str):
    """Get all routes created by a user"""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    routes = await db.routes.find({"userId": user_id}).sort("createdAt", -1).to_list(100)
    return [route_helper(r) for r in routes]

@api_router.get("/routes/saved/{user_id}")
async def get_saved_routes(user_id: str):
    """Get routes saved by a user"""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    routes = await db.routes.find({"savedBy": user_id}).sort("createdAt", -1).to_list(100)
    return [route_helper(r) for r in routes]

@api_router.get("/routes/{route_id}")
async def get_route(route_id: str):
    """Get a specific route"""
    if not ObjectId.is_valid(route_id):
        raise HTTPException(status_code=400, detail="Invalid route ID")
    
    route = await db.routes.find_one({"_id": ObjectId(route_id)})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    return route_helper(route)

@api_router.put("/routes/{route_id}")
async def update_route(route_id: str, route_update: RouteUpdate):
    """Update a route"""
    if not ObjectId.is_valid(route_id):
        raise HTTPException(status_code=400, detail="Invalid route ID")
    
    update_data = {k: v for k, v in route_update.dict().items() if v is not None}
    update_data["updatedAt"] = datetime.utcnow().isoformat()
    
    await db.routes.update_one(
        {"_id": ObjectId(route_id)},
        {"$set": update_data}
    )
    
    updated_route = await db.routes.find_one({"_id": ObjectId(route_id)})
    return route_helper(updated_route)

@api_router.delete("/routes/{route_id}")
async def delete_route(route_id: str, user_id: str = Query(...)):
    """Delete a route (only by owner)"""
    if not ObjectId.is_valid(route_id):
        raise HTTPException(status_code=400, detail="Invalid route ID")
    
    route = await db.routes.find_one({"_id": ObjectId(route_id)})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    if route["userId"] != user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own routes")
    
    await db.routes.delete_one({"_id": ObjectId(route_id)})
    return {"message": "Route deleted successfully"}

@api_router.post("/routes/{route_id}/like")
async def like_route(route_id: str, user_id: str = Query(...)):
    """Like a route"""
    if not ObjectId.is_valid(route_id):
        raise HTTPException(status_code=400, detail="Invalid route ID")
    
    await db.routes.update_one(
        {"_id": ObjectId(route_id)},
        {"$inc": {"likes": 1}}
    )
    
    updated_route = await db.routes.find_one({"_id": ObjectId(route_id)})
    return route_helper(updated_route)

@api_router.post("/routes/{route_id}/save")
async def save_route(route_id: str, user_id: str = Query(...)):
    """Save a route to user's collection"""
    if not ObjectId.is_valid(route_id):
        raise HTTPException(status_code=400, detail="Invalid route ID")
    
    route = await db.routes.find_one({"_id": ObjectId(route_id)})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    if user_id in route.get("savedBy", []):
        # Already saved, unsave it
        await db.routes.update_one(
            {"_id": ObjectId(route_id)},
            {"$pull": {"savedBy": user_id}}
        )
        message = "Route removed from saved"
    else:
        # Save it
        await db.routes.update_one(
            {"_id": ObjectId(route_id)},
            {"$addToSet": {"savedBy": user_id}}
        )
        message = "Route saved successfully"
    
    updated_route = await db.routes.find_one({"_id": ObjectId(route_id)})
    return {"message": message, "route": route_helper(updated_route)}

@api_router.post("/routes/{route_id}/share")
async def share_route(route_id: str, recipient_ids: List[str] = Query(...), sender_name: str = Query(...)):
    """Share a route with other users"""
    if not ObjectId.is_valid(route_id):
        raise HTTPException(status_code=400, detail="Invalid route ID")
    
    route = await db.routes.find_one({"_id": ObjectId(route_id)})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    notifications = []
    for recipient_id in recipient_ids:
        if ObjectId.is_valid(recipient_id):
            user = await db.users.find_one({"_id": ObjectId(recipient_id)})
            if user:
                notification = {
                    "userId": recipient_id,
                    "type": "route_shared",
                    "title": f"{sender_name} shared a route with you!",
                    "message": f"Check out '{route['name']}' - {route['description'][:100]}",
                    "routeId": route_id,
                    "isRead": False,
                    "createdAt": datetime.utcnow().isoformat()
                }
                notifications.append(notification)
                
                if user.get("pushToken"):
                    try:
                        await send_push_notification(
                            user["pushToken"],
                            notification["title"],
                            notification["message"],
                            {"type": "route_shared", "routeId": route_id}
                        )
                    except Exception as e:
                        print(f"Failed to send push notification: {e}")
    
    if notifications:
        await db.notifications.insert_many(notifications)
    
    return {"message": f"Route shared with {len(notifications)} users"}

@api_router.post("/auth/register")
async def register_user(user: UserCreate):
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_dict = user.dict()
    user_dict["createdAt"] = datetime.utcnow().isoformat()
    
    result = await db.users.insert_one(user_dict)
    created_user = await db.users.find_one({"_id": result.inserted_id})
    return user_helper(created_user)

@api_router.post("/auth/login")
async def login_user(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or user["password"] != credentials.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    return user_helper(user)

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, user_update: UserUpdate):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    update_data = {k: v for k, v in user_update.dict().items() if v is not None}
    
    if update_data:
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )
    
    updated_user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user_helper(updated_user)

# Register Push Token
class PushTokenRegister(BaseModel):
    userId: str
    pushToken: str

@api_router.post("/users/register-push-token")
async def register_push_token(data: PushTokenRegister):
    if not ObjectId.is_valid(data.userId):
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    result = await db.users.update_one(
        {"_id": ObjectId(data.userId)},
        {"$set": {"pushToken": data.pushToken}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Push token registered successfully"}

# User Car Helper
def user_car_helper(car) -> dict:
    return {
        "id": str(car["_id"]),
        "userId": car["userId"],
        "make": car["make"],
        "model": car["model"],
        "year": car["year"],
        "color": car.get("color", ""),
        "trim": car.get("trim", ""),
        "engine": car.get("engine", ""),
        "horsepower": car.get("horsepower"),
        "torque": car.get("torque"),
        "transmission": car.get("transmission", ""),
        "drivetrain": car.get("drivetrain", ""),
        "description": car.get("description", ""),
        "photos": car.get("photos", []),
        "videos": car.get("videos", []),
        "modifications": car.get("modifications", []),
        "modificationNotes": car.get("modificationNotes", ""),
        "isPublic": car.get("isPublic", True),
        "instagramHandle": car.get("instagramHandle", ""),
        "youtubeChannel": car.get("youtubeChannel", ""),
        "likes": car.get("likes", 0),
        "views": car.get("views", 0),
        "createdAt": car.get("createdAt"),
        "updatedAt": car.get("updatedAt"),
    }

# User Car Routes
@api_router.post("/user-cars")
async def create_user_car(car: UserCarCreate):
    car_dict = car.dict()
    car_dict["likes"] = 0
    car_dict["views"] = 0
    car_dict["createdAt"] = datetime.utcnow().isoformat()
    
    # Check if user already has a car, if so update instead
    existing = await db.user_cars.find_one({"userId": car.userId})
    if existing:
        await db.user_cars.update_one(
            {"_id": existing["_id"]},
            {"$set": {**car_dict, "updatedAt": datetime.utcnow().isoformat()}}
        )
        updated_car = await db.user_cars.find_one({"_id": existing["_id"]})
        return user_car_helper(updated_car)
    
    result = await db.user_cars.insert_one(car_dict)
    created_car = await db.user_cars.find_one({"_id": result.inserted_id})
    return user_car_helper(created_car)

@api_router.get("/user-cars/user/{user_id}")
async def get_user_car(user_id: str):
    car = await db.user_cars.find_one({"userId": user_id})
    if not car:
        return None
    return user_car_helper(car)

@api_router.get("/user-cars/public")
async def get_public_garages(
    make: Optional[str] = None,
    limit: int = Query(default=50, le=100)
):
    """Get all public garages to browse"""
    query = {"isPublic": True}
    if make:
        query["make"] = {"$regex": make, "$options": "i"}
    
    cars = await db.user_cars.find(query).sort("createdAt", -1).limit(limit).to_list(limit)
    
    # Get user info for each car
    result = []
    for car in cars:
        user = await db.users.find_one({"_id": ObjectId(car["userId"])}) if ObjectId.is_valid(car["userId"]) else None
        car_data = user_car_helper(car)
        car_data["ownerName"] = user.get("name", "Unknown") if user else "Unknown"
        car_data["ownerNickname"] = user.get("nickname", "") if user else ""
        result.append(car_data)
    
    return result

@api_router.get("/user-cars/{car_id}")
async def get_car_by_id(car_id: str):
    """Get a specific car by ID"""
    if not ObjectId.is_valid(car_id):
        raise HTTPException(status_code=400, detail="Invalid car ID")
    
    car = await db.user_cars.find_one({"_id": ObjectId(car_id)})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    
    # Increment view count
    await db.user_cars.update_one(
        {"_id": ObjectId(car_id)},
        {"$inc": {"views": 1}}
    )
    
    # Get owner info
    user = await db.users.find_one({"_id": ObjectId(car["userId"])}) if ObjectId.is_valid(car["userId"]) else None
    car_data = user_car_helper(car)
    car_data["ownerName"] = user.get("name", "Unknown") if user else "Unknown"
    car_data["ownerNickname"] = user.get("nickname", "") if user else ""
    
    return car_data

@api_router.put("/user-cars/{car_id}")
async def update_user_car(car_id: str, car_update: UserCarUpdate):
    if not ObjectId.is_valid(car_id):
        raise HTTPException(status_code=400, detail="Invalid car ID")
    
    update_data = {k: v for k, v in car_update.dict().items() if v is not None}
    update_data["updatedAt"] = datetime.utcnow().isoformat()
    
    if update_data:
        await db.user_cars.update_one(
            {"_id": ObjectId(car_id)},
            {"$set": update_data}
        )
    
    updated_car = await db.user_cars.find_one({"_id": ObjectId(car_id)})
    if not updated_car:
        raise HTTPException(status_code=404, detail="Car not found")
    
    return user_car_helper(updated_car)

@api_router.post("/user-cars/{car_id}/like")
async def like_car(car_id: str, user_id: str = Query(...)):
    """Like a car in someone's garage"""
    if not ObjectId.is_valid(car_id):
        raise HTTPException(status_code=400, detail="Invalid car ID")
    
    await db.user_cars.update_one(
        {"_id": ObjectId(car_id)},
        {"$inc": {"likes": 1}}
    )
    
    updated_car = await db.user_cars.find_one({"_id": ObjectId(car_id)})
    return user_car_helper(updated_car)

@api_router.delete("/user-cars/{car_id}")
async def delete_user_car(car_id: str, user_id: str = Query(...)):
    """Delete a car from garage"""
    if not ObjectId.is_valid(car_id):
        raise HTTPException(status_code=400, detail="Invalid car ID")
    
    car = await db.user_cars.find_one({"_id": ObjectId(car_id)})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    
    if car["userId"] != user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own cars")
    
    await db.user_cars.delete_one({"_id": ObjectId(car_id)})
    return {"message": "Car deleted successfully"}

# Favorites Routes
@api_router.post("/favorites")
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

@api_router.get("/favorites/user/{user_id}")
async def get_user_favorites(user_id: str):
    favorites = await db.favorites.find({"userId": user_id}).to_list(1000)
    event_ids = [ObjectId(fav["eventId"]) for fav in favorites if ObjectId.is_valid(fav["eventId"])]
    
    events = await db.events.find({"_id": {"$in": event_ids}}).to_list(1000)
    return [event_helper(event) for event in events]

@api_router.delete("/favorites/{user_id}/{event_id}")
async def remove_favorite(user_id: str, event_id: str):
    result = await db.favorites.delete_one({
        "userId": user_id,
        "eventId": event_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Favorite not found")
    
    return {"message": "Removed from favorites"}

# RSVP Routes
@api_router.post("/rsvps")
async def create_rsvp(rsvp: RSVPCreate):
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
        
        # Update attendee count
        if rsvp.status == "going":
            await db.events.update_one(
                {"_id": ObjectId(rsvp.eventId)},
                {"$inc": {"attendeeCount": 1}}
            )
    
    return {"message": "RSVP updated"}

@api_router.get("/rsvps/user/{user_id}")
async def get_user_rsvps(user_id: str):
    rsvps = await db.rsvps.find({"userId": user_id, "status": "going"}).to_list(1000)
    event_ids = [ObjectId(rsvp["eventId"]) for rsvp in rsvps if ObjectId.is_valid(rsvp["eventId"])]
    
    events = await db.events.find({"_id": {"$in": event_ids}}).to_list(1000)
    return [event_helper(event) for event in events]

# Comments Routes
@api_router.post("/comments")
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

@api_router.get("/comments/event/{event_id}")
async def get_event_comments(event_id: str):
    comments = await db.comments.find({"eventId": event_id}).sort("createdAt", -1).to_list(1000)
    return [{
        "id": str(comment["_id"]),
        "eventId": comment["eventId"],
        "userId": comment["userId"],
        "userName": comment["userName"],
        "text": comment["text"],
        "rating": comment.get("rating"),
        "createdAt": comment["createdAt"]
    } for comment in comments]

# Messaging Routes
@api_router.post("/messages")
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

@api_router.get("/messages/conversations/{user_id}")
async def get_conversations(user_id: str):
    # Get all messages where user is sender or recipient
    messages = await db.messages.find({
        "$or": [{"senderId": user_id}, {"recipientId": user_id}]
    }).sort("createdAt", -1).to_list(1000)
    
    # Group by conversation partner
    conversations = {}
    for msg in messages:
        partner_id = msg["recipientId"] if msg["senderId"] == user_id else msg["senderId"]
        
        if partner_id not in conversations:
            # Get partner info
            partner = await db.users.find_one({"_id": ObjectId(partner_id)})
            if partner:
                conversations[partner_id] = {
                    "partnerId": partner_id,
                    "partnerName": partner["name"],
                    "partnerNickname": partner.get("nickname", ""),
                    "lastMessage": msg["content"],
                    "lastMessageTime": msg["createdAt"],
                    "unreadCount": 0
                }
        
        # Count unread messages from partner
        if msg["recipientId"] == user_id and not msg.get("isRead", False):
            conversations[partner_id]["unreadCount"] += 1
    
    return list(conversations.values())

@api_router.get("/messages/thread/{user_id}/{partner_id}")
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
    
    return [{
        "id": str(msg["_id"]),
        "senderId": msg["senderId"],
        "recipientId": msg["recipientId"],
        "content": msg["content"],
        "isRead": msg.get("isRead", False),
        "createdAt": msg["createdAt"]
    } for msg in messages]

# Location Sharing Routes
@api_router.post("/locations")
async def update_location(location: LocationUpdate):
    location_dict = location.dict()
    location_dict["updatedAt"] = datetime.utcnow().isoformat()
    
    # Update or insert location
    await db.locations.update_one(
        {"userId": location.userId},
        {"$set": location_dict},
        upsert=True
    )
    
    return {"message": "Location updated successfully"}

@api_router.get("/locations/nearby/{user_id}")
async def get_nearby_users(user_id: str, radius: float = 50.0):
    # Get user's location
    user_location = await db.locations.find_one({"userId": user_id})
    if not user_location:
        return []
    
    user_lat = user_location["latitude"]
    user_lon = user_location["longitude"]
    
    # Get all sharing locations
    locations = await db.locations.find({
        "isSharing": True,
        "userId": {"$ne": user_id}
    }).to_list(1000)
    
    nearby_users = []
    for loc in locations:
        # Simple distance calculation (approximate)
        lat_diff = abs(loc["latitude"] - user_lat)
        lon_diff = abs(loc["longitude"] - user_lon)
        distance = ((lat_diff ** 2 + lon_diff ** 2) ** 0.5) * 69  # Rough miles
        
        if distance <= radius:
            user = await db.users.find_one({"_id": ObjectId(loc["userId"])})
            if user:
                nearby_users.append({
                    "userId": loc["userId"],
                    "name": user["name"],
                    "nickname": user.get("nickname", ""),
                    "latitude": loc["latitude"],
                    "longitude": loc["longitude"],
                    "distance": round(distance, 2),
                    "updatedAt": loc["updatedAt"]
                })
    
    return sorted(nearby_users, key=lambda x: x["distance"])

@api_router.get("/locations/{user_id}")
async def get_user_location(user_id: str):
    location = await db.locations.find_one({"userId": user_id, "isSharing": True})
    if not location:
        return None
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    
    return {
        "userId": user_id,
        "name": user["name"] if user else "Unknown",
        "nickname": user.get("nickname", "") if user else "",
        "latitude": location["latitude"],
        "longitude": location["longitude"],
        "updatedAt": location["updatedAt"]
    }

@api_router.delete("/locations/{user_id}")
async def stop_sharing_location(user_id: str):
    await db.locations.update_one(
        {"userId": user_id},
        {"$set": {"isSharing": False}}
    )
    return {"message": "Location sharing stopped"}

# Notification Routes
@api_router.get("/notifications/{user_id}")
async def get_notifications(user_id: str, unread_only: bool = False):
    query = {"userId": user_id}
    if unread_only:
        query["isRead"] = False
    
    notifications = await db.notifications.find(query).sort("createdAt", -1).limit(50).to_list(50)
    return [{
        "id": str(notif["_id"]),
        "userId": notif["userId"],
        "eventId": notif.get("eventId"),
        "type": notif["type"],
        "title": notif["title"],
        "message": notif["message"],
        "isRead": notif["isRead"],
        "createdAt": notif["createdAt"]
    } for notif in notifications]

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(status_code=400, detail="Invalid notification ID")
    
    await db.notifications.update_one(
        {"_id": ObjectId(notification_id)},
        {"$set": {"isRead": True}}
    )
    return {"message": "Notification marked as read"}

@api_router.put("/notifications/user/{user_id}/read-all")
async def mark_all_notifications_read(user_id: str):
    await db.notifications.update_many(
        {"userId": user_id, "isRead": False},
        {"$set": {"isRead": True}}
    )
    return {"message": "All notifications marked as read"}

# Performance Run Routes
@api_router.post("/performance-runs")
async def create_performance_run(run: PerformanceRunCreate):
    run_dict = run.dict()
    run_dict["createdAt"] = datetime.utcnow().isoformat()
    
    result = await db.performance_runs.insert_one(run_dict)
    created_run = await db.performance_runs.find_one({"_id": result.inserted_id})
    
    return {
        "id": str(created_run["_id"]),
        "userId": created_run["userId"],
        "carInfo": created_run["carInfo"],
        "zeroToSixty": created_run.get("zeroToSixty"),
        "zeroToHundred": created_run.get("zeroToHundred"),
        "quarterMile": created_run.get("quarterMile"),
        "location": created_run.get("location", ""),
        "createdAt": created_run["createdAt"]
    }

@api_router.get("/leaderboard/0-60")
async def get_zero_to_sixty_leaderboard(limit: int = 100):
    runs = await db.performance_runs.find(
        {"zeroToSixty": {"$exists": True, "$ne": None}}
    ).sort("zeroToSixty", 1).limit(limit).to_list(limit)
    
    leaderboard = []
    for run in runs:
        user = await db.users.find_one({"_id": ObjectId(run["userId"])})
        leaderboard.append({
            "id": str(run["_id"]),
            "userId": run["userId"],
            "userName": user["name"] if user else "Unknown",
            "nickname": user.get("nickname", "") if user else "",
            "carInfo": run["carInfo"],
            "time": run["zeroToSixty"],
            "location": run.get("location", ""),
            "createdAt": run["createdAt"]
        })
    
    return leaderboard

@api_router.get("/leaderboard/0-100")
async def get_zero_to_hundred_leaderboard(limit: int = 100):
    runs = await db.performance_runs.find(
        {"zeroToHundred": {"$exists": True, "$ne": None}}
    ).sort("zeroToHundred", 1).limit(limit).to_list(limit)
    
    leaderboard = []
    for run in runs:
        user = await db.users.find_one({"_id": ObjectId(run["userId"])})
        leaderboard.append({
            "id": str(run["_id"]),
            "userId": run["userId"],
            "userName": user["name"] if user else "Unknown",
            "nickname": user.get("nickname", "") if user else "",
            "carInfo": run["carInfo"],
            "time": run["zeroToHundred"],
            "location": run.get("location", ""),
            "createdAt": run["createdAt"]
        })
    
    return leaderboard

@api_router.get("/leaderboard/quarter-mile")
async def get_quarter_mile_leaderboard(limit: int = 100):
    runs = await db.performance_runs.find(
        {"quarterMile": {"$exists": True, "$ne": None}}
    ).sort("quarterMile", 1).limit(limit).to_list(limit)
    
    leaderboard = []
    for run in runs:
        user = await db.users.find_one({"_id": ObjectId(run["userId"])})
        leaderboard.append({
            "id": str(run["_id"]),
            "userId": run["userId"],
            "userName": user["name"] if user else "Unknown",
            "nickname": user.get("nickname", "") if user else "",
            "carInfo": run["carInfo"],
            "time": run["quarterMile"],
            "location": run.get("location", ""),
            "createdAt": run["createdAt"]
        })
    
    return leaderboard

@api_router.get("/performance-runs/user/{user_id}")
async def get_user_performance_runs(user_id: str):
    runs = await db.performance_runs.find({"userId": user_id}).sort("createdAt", -1).to_list(1000)
    
    return [{
        "id": str(run["_id"]),
        "userId": run["userId"],
        "carInfo": run["carInfo"],
        "zeroToSixty": run.get("zeroToSixty"),
        "zeroToHundred": run.get("zeroToHundred"),
        "quarterMile": run.get("quarterMile"),
        "location": run.get("location", ""),
        "createdAt": run["createdAt"]
    } for run in runs]

# Club Routes
@api_router.post("/clubs")
async def create_club(club: ClubCreate):
    club_dict = club.dict()
    club_dict["createdAt"] = datetime.utcnow().isoformat()
    
    # If userId is provided, check if user is admin
    if club_dict.get("userId"):
        user = await db.users.find_one({"_id": ObjectId(club_dict["userId"])})
        club_dict["isApproved"] = user.get("isAdmin", False) if user else False
    else:
        # Guest submissions require approval
        club_dict["isApproved"] = False
    
    result = await db.clubs.insert_one(club_dict)
    created_club = await db.clubs.find_one({"_id": result.inserted_id})
    
    return {
        "id": str(created_club["_id"]),
        "name": created_club["name"],
        "description": created_club["description"],
        "location": created_club["location"],
        "city": created_club["city"],
        "carTypes": created_club.get("carTypes", []),
        "contactInfo": created_club.get("contactInfo", ""),
        "website": created_club.get("website", ""),
        "facebookGroup": created_club.get("facebookGroup", ""),
        "meetingSchedule": created_club.get("meetingSchedule", ""),
        "memberCount": created_club.get("memberCount", ""),
        "isApproved": created_club.get("isApproved", False),
        "createdAt": created_club["createdAt"]
    }

@api_router.get("/clubs")
async def get_clubs(city: Optional[str] = Query(None), carType: Optional[str] = Query(None)):
    query = {"isApproved": True}
    
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    
    if carType:
        query["carTypes"] = {"$regex": carType, "$options": "i"}
    
    clubs = await db.clubs.find(query).sort("name", 1).to_list(1000)
    return [{
        "id": str(club["_id"]),
        "name": club["name"],
        "description": club.get("description", ""),
        "location": club.get("location", ""),
        "focus": club.get("focus", ""),
        "meetingSchedule": club.get("meetingSchedule", ""),
        "contactEmail": club.get("contactEmail", ""),
        "website": club.get("website", ""),
        "memberCount": club.get("memberCount", 0),
        "isApproved": club.get("isApproved", True),
        "createdAt": club.get("createdAt")
    } for club in clubs]

@api_router.get("/clubs/{club_id}")
async def get_club(club_id: str):
    if not ObjectId.is_valid(club_id):
        raise HTTPException(status_code=400, detail="Invalid club ID")
    
    club = await db.clubs.find_one({"_id": ObjectId(club_id)})
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")
    
    return {
        "id": str(club["_id"]),
        "name": club["name"],
        "description": club["description"],
        "location": club["location"],
        "city": club["city"],
        "carTypes": club.get("carTypes", []),
        "contactInfo": club.get("contactInfo", ""),
        "website": club.get("website", ""),
        "facebookGroup": club.get("facebookGroup", ""),
        "meetingSchedule": club.get("meetingSchedule", ""),
        "memberCount": club.get("memberCount", ""),
        "createdAt": club.get("createdAt")
    }

# Admin Routes
@api_router.get("/admin/events/pending")
async def get_pending_events(admin_id: str):
    # Verify admin
    if not ObjectId.is_valid(admin_id):
        raise HTTPException(status_code=400, detail="Invalid admin ID")
    
    admin = await db.users.find_one({"_id": ObjectId(admin_id)})
    if not admin or not admin.get("isAdmin", False):
        raise HTTPException(status_code=403, detail="Unauthorized - Admin access required")
    
    pending_events = await db.events.find({"isApproved": False}).sort("createdAt", -1).to_list(1000)
    return [event_helper(event) for event in pending_events]

@api_router.put("/admin/events/{event_id}/approve")
async def approve_event(event_id: str, admin_id: str):
    # Verify admin
    if not ObjectId.is_valid(admin_id):
        raise HTTPException(status_code=400, detail="Invalid admin ID")
    
    admin = await db.users.find_one({"_id": ObjectId(admin_id)})
    if not admin or not admin.get("isAdmin", False):
        raise HTTPException(status_code=403, detail="Unauthorized - Admin access required")
    
    # Approve event
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")
    
    result = await db.events.update_one(
        {"_id": ObjectId(event_id)},
        {"$set": {"isApproved": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    
    updated_event = await db.events.find_one({"_id": ObjectId(event_id)})
    
    # If it's a Pop Up event, send notifications to all users
    if updated_event.get("isPopUp"):
        users = await db.users.find({"notificationsEnabled": {"$ne": False}}).to_list(10000)
        
        notifications = []
        for user in users:
            if str(user["_id"]) != updated_event.get("userId"):
                notification = {
                    "userId": str(user["_id"]),
                    "eventId": event_id,
                    "type": "popup_event",
                    "title": f"🚨 Pop Up Event: {updated_event['title']}",
                    "message": f"{updated_event['eventType']} happening {updated_event['date']} at {updated_event['time']} in {updated_event['city']}!",
                    "isRead": False,
                    "createdAt": datetime.utcnow().isoformat()
                }
                notifications.append(notification)
        
        if notifications:
            await db.notifications.insert_many(notifications)
    
    return event_helper(updated_event)

@api_router.delete("/admin/events/{event_id}/reject")
async def reject_event(event_id: str, admin_id: str):
    # Verify admin
    if not ObjectId.is_valid(admin_id):
        raise HTTPException(status_code=400, detail="Invalid admin ID")
    
    admin = await db.users.find_one({"_id": ObjectId(admin_id)})
    if not admin or not admin.get("isAdmin", False):
        raise HTTPException(status_code=403, detail="Unauthorized - Admin access required")
    
    # Delete event
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")
    
    result = await db.events.delete_one({"_id": ObjectId(event_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    
    return {"message": "Event rejected and deleted"}

# Admin Club Routes
@api_router.get("/admin/clubs/pending")
async def get_pending_clubs(admin_id: str):
    # Verify admin
    if not ObjectId.is_valid(admin_id):
        raise HTTPException(status_code=400, detail="Invalid admin ID")
    
    admin = await db.users.find_one({"_id": ObjectId(admin_id)})
    if not admin or not admin.get("isAdmin", False):
        raise HTTPException(status_code=403, detail="Unauthorized - Admin access required")
    
    pending_clubs = await db.clubs.find({"isApproved": False}).sort("createdAt", -1).to_list(1000)
    return [{
        "id": str(club["_id"]),
        "name": club["name"],
        "description": club["description"],
        "location": club["location"],
        "city": club["city"],
        "carTypes": club.get("carTypes", []),
        "contactInfo": club.get("contactInfo", ""),
        "website": club.get("website", ""),
        "facebookGroup": club.get("facebookGroup", ""),
        "meetingSchedule": club.get("meetingSchedule", ""),
        "memberCount": club.get("memberCount", ""),
        "createdAt": club.get("createdAt")
    } for club in pending_clubs]

@api_router.put("/admin/clubs/{club_id}/approve")
async def approve_club(club_id: str, admin_id: str):
    # Verify admin
    if not ObjectId.is_valid(admin_id):
        raise HTTPException(status_code=400, detail="Invalid admin ID")
    
    admin = await db.users.find_one({"_id": ObjectId(admin_id)})
    if not admin or not admin.get("isAdmin", False):
        raise HTTPException(status_code=403, detail="Unauthorized - Admin access required")
    
    # Approve club
    if not ObjectId.is_valid(club_id):
        raise HTTPException(status_code=400, detail="Invalid club ID")
    
    result = await db.clubs.update_one(
        {"_id": ObjectId(club_id)},
        {"$set": {"isApproved": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Club not found")
    
    updated_club = await db.clubs.find_one({"_id": ObjectId(club_id)})
    return {
        "id": str(updated_club["_id"]),
        "name": updated_club["name"],
        "description": updated_club["description"],
        "location": updated_club["location"],
        "city": updated_club["city"],
        "carTypes": updated_club.get("carTypes", []),
        "contactInfo": updated_club.get("contactInfo", ""),
        "website": updated_club.get("website", ""),
        "facebookGroup": updated_club.get("facebookGroup", ""),
        "meetingSchedule": updated_club.get("meetingSchedule", ""),
        "memberCount": updated_club.get("memberCount", ""),
        "isApproved": updated_club.get("isApproved", False),
        "createdAt": updated_club.get("createdAt")
    }

@api_router.delete("/admin/clubs/{club_id}/reject")
async def reject_club(club_id: str, admin_id: str):
    # Verify admin
    if not ObjectId.is_valid(admin_id):
        raise HTTPException(status_code=400, detail="Invalid admin ID")
    
    admin = await db.users.find_one({"_id": ObjectId(admin_id)})
    if not admin or not admin.get("isAdmin", False):
        raise HTTPException(status_code=403, detail="Unauthorized - Admin access required")
    
    # Delete club
    if not ObjectId.is_valid(club_id):
        raise HTTPException(status_code=400, detail="Invalid club ID")
    
    result = await db.clubs.delete_one({"_id": ObjectId(club_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Club not found")
    
    return {"message": "Club rejected and deleted"}

# ==================== Event Import API ====================
@api_router.post("/admin/events/import")
async def import_events(admin_id: str):
    """
    Import events from external sources (Eventbrite, sample data).
    Admin only endpoint.
    """
    from event_sources import import_events_from_sources
    
    # Verify admin
    if not ObjectId.is_valid(admin_id):
        raise HTTPException(status_code=400, detail="Invalid admin ID")
    
    admin = await db.users.find_one({"_id": ObjectId(admin_id)})
    if not admin or not admin.get("isAdmin", False):
        raise HTTPException(status_code=403, detail="Unauthorized - Admin access required")
    
    try:
        stats = await import_events_from_sources(db)
        return {
            "message": "Event import completed",
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== WebSocket Connection Manager ====================

class ConnectionManager:
    """Manages WebSocket connections for real-time messaging"""
    
    def __init__(self):
        # Maps user_id to their WebSocket connection
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

# Create global connection manager
ws_manager = ConnectionManager()

# WebSocket endpoint for real-time messaging
@app.websocket("/ws/messages/{user_id}")
async def websocket_messages(websocket: WebSocket, user_id: str):
    """WebSocket endpoint for real-time message updates"""
    await ws_manager.connect(websocket, user_id)
    try:
        while True:
            # Receive messages from client
            data = await websocket.receive_json()
            
            if data.get("type") == "message":
                # Create and save message
                message_dict = {
                    "senderId": user_id,
                    "recipientId": data["recipientId"],
                    "content": data["content"],
                    "createdAt": datetime.utcnow().isoformat(),
                    "isRead": False,
                }
                
                result = await db.messages.insert_one(message_dict)
                created_message = await db.messages.find_one({"_id": result.inserted_id})
                
                # Get sender info
                sender = await db.users.find_one({"_id": ObjectId(user_id)})
                sender_name = sender.get("name", "Unknown") if sender else "Unknown"
                
                # Prepare message for sending
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
                
                # Send to recipient if online
                await ws_manager.send_personal_message(ws_message, data["recipientId"])
                
                # Send confirmation back to sender
                await websocket.send_json({
                    "type": "message_sent",
                    "message": ws_message["message"]
                })
            
            elif data.get("type") == "typing":
                # Notify recipient that user is typing
                await ws_manager.send_personal_message({
                    "type": "typing",
                    "userId": user_id,
                }, data["recipientId"])
            
            elif data.get("type") == "read":
                # Mark messages as read
                await db.messages.update_many(
                    {"senderId": data["senderId"], "recipientId": user_id, "isRead": False},
                    {"$set": {"isRead": True}}
                )
                # Notify sender that messages were read
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

# API endpoint to check online status
@api_router.get("/messages/online/{user_id}")
async def check_user_online(user_id: str):
    """Check if a user is currently online (connected via WebSocket)"""
    return {"online": ws_manager.is_online(user_id)}

@api_router.get("/messages/online")
async def get_online_users():
    """Get list of all online users"""
    return {"online_users": ws_manager.get_online_users()}

# Include the router in the main app - MUST be after all route definitions
app.include_router(api_router)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
