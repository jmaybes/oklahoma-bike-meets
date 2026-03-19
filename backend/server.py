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
        "createdAt": event.get("createdAt"),
        "contactInfo": event.get("contactInfo", ""),
        "website": event.get("website", ""),
    }

def user_helper(user) -> dict:
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user["name"],
        "profilePic": user.get("profilePic", ""),
        "isAdmin": user.get("isAdmin", False),
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
    profilePic: str = ""
    isAdmin: bool = False

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

# Club Routes
@api_router.post("/clubs")
async def create_club(club: ClubCreate):
    club_dict = club.dict()
    club_dict["createdAt"] = datetime.utcnow().isoformat()
    
    result = await db.clubs.insert_one(club_dict)
    created_club = await db.clubs.find_one({"_id": result.inserted_id})
    
    return {
        "id": str(created_club["_id"]),
        **club.dict(),
        "createdAt": created_club["createdAt"]
    }

@api_router.get("/clubs")
async def get_clubs(city: Optional[str] = Query(None), carType: Optional[str] = Query(None)):
    query = {}
    
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    
    if carType:
        query["carTypes"] = {"$regex": carType, "$options": "i"}
    
    clubs = await db.clubs.find(query).sort("name", 1).to_list(1000)
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
