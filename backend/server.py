from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

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

class UserUpdate(BaseModel):
    name: Optional[str] = None
    nickname: Optional[str] = None
    profilePic: Optional[str] = None
    notificationsEnabled: Optional[bool] = None

class UserCarCreate(BaseModel):
    userId: str
    make: str
    model: str
    year: str
    color: str = ""
    modifications: str = ""
    description: str = ""
    photos: List[str] = []

class UserCarUpdate(BaseModel):
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[str] = None
    color: Optional[str] = None
    modifications: Optional[str] = None
    description: Optional[str] = None
    photos: Optional[List[str]] = None

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

# User Routes
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

# User Car Routes
@api_router.post("/user-cars")
async def create_user_car(car: UserCarCreate):
    car_dict = car.dict()
    car_dict["createdAt"] = datetime.utcnow().isoformat()
    
    result = await db.user_cars.insert_one(car_dict)
    created_car = await db.user_cars.find_one({"_id": result.inserted_id})
    
    return {
        "id": str(created_car["_id"]),
        "userId": created_car["userId"],
        "make": created_car["make"],
        "model": created_car["model"],
        "year": created_car["year"],
        "color": created_car.get("color", ""),
        "modifications": created_car.get("modifications", ""),
        "description": created_car.get("description", ""),
        "photos": created_car.get("photos", []),
        "createdAt": created_car["createdAt"]
    }

@api_router.get("/user-cars/user/{user_id}")
async def get_user_car(user_id: str):
    car = await db.user_cars.find_one({"userId": user_id})
    if not car:
        return None
    
    return {
        "id": str(car["_id"]),
        "userId": car["userId"],
        "make": car["make"],
        "model": car["model"],
        "year": car["year"],
        "color": car.get("color", ""),
        "modifications": car.get("modifications", ""),
        "description": car.get("description", ""),
        "photos": car.get("photos", []),
        "createdAt": car.get("createdAt")
    }

@api_router.put("/user-cars/{car_id}")
async def update_user_car(car_id: str, car_update: UserCarUpdate):
    if not ObjectId.is_valid(car_id):
        raise HTTPException(status_code=400, detail="Invalid car ID")
    
    update_data = {k: v for k, v in car_update.dict().items() if v is not None}
    
    if update_data:
        await db.user_cars.update_one(
            {"_id": ObjectId(car_id)},
            {"$set": update_data}
        )
    
    updated_car = await db.user_cars.find_one({"_id": ObjectId(car_id)})
    if not updated_car:
        raise HTTPException(status_code=404, detail="Car not found")
    
    return {
        "id": str(updated_car["_id"]),
        "userId": updated_car["userId"],
        "make": updated_car["make"],
        "model": updated_car["model"],
        "year": updated_car["year"],
        "color": updated_car.get("color", ""),
        "modifications": updated_car.get("modifications", ""),
        "description": updated_car.get("description", ""),
        "photos": updated_car.get("photos", []),
        "createdAt": updated_car.get("createdAt")
    }

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

# Include the router in the main app
app.include_router(api_router)

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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
