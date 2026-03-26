from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from bson import ObjectId

from database import db
from models import LocationUpdate, MeetupInviteRequest
from helpers import haversine_distance, send_push_notification

router = APIRouter()

# Prewritten invite messages
PREWRITTEN_INVITES = [
    "Hey car enthusiasts! I'm nearby and looking to meet up. Anyone want to cruise?",
    "Pop-up meet happening now! Come check out some rides in the area!",
    "Looking for fellow car lovers to hang out. Who's around?",
    "Spontaneous car meet! Drop your location if you're interested!",
    "Any gearheads nearby want to link up and talk cars?"
]


# ==================== Nearby Users (Haversine-based) ====================

@router.get("/users/nearby/{user_id}")
async def get_nearby_users(
    user_id: str,
    latitude: float = Query(...),
    longitude: float = Query(...),
    radius: float = Query(default=25, le=50)
):
    """Get all users within specified radius who have location sharing enabled"""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"latitude": latitude, "longitude": longitude}}
    )

    users = await db.users.find({
        "locationSharingEnabled": {"$ne": False},
        "locationPrivate": {"$ne": True},
        "latitude": {"$exists": True, "$ne": None},
        "longitude": {"$exists": True, "$ne": None},
        "_id": {"$ne": ObjectId(user_id)}
    }, {
        "_id": 1, "name": 1, "nickname": 1, "profilePic": 1,
        "latitude": 1, "longitude": 1
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

    nearby_users.sort(key=lambda x: x["distance"])

    return {
        "count": len(nearby_users),
        "radius": radius,
        "users": nearby_users
    }


# ==================== Meetup Invites ====================

@router.get("/meetup/prewritten-messages")
async def get_prewritten_messages():
    """Get list of prewritten meetup invite messages"""
    return {"messages": PREWRITTEN_INVITES}


@router.post("/meetup/send-invite")
async def send_meetup_invite(invite: MeetupInviteRequest):
    """Send meetup invite to all users within specified radius"""
    if not ObjectId.is_valid(invite.senderId):
        raise HTTPException(status_code=400, detail="Invalid sender ID")

    sender = await db.users.find_one({"_id": ObjectId(invite.senderId)})
    if not sender:
        raise HTTPException(status_code=404, detail="Sender not found")

    users = await db.users.find({
        "locationSharingEnabled": {"$ne": False},
        "notificationsEnabled": {"$ne": False},
        "latitude": {"$exists": True, "$ne": None},
        "longitude": {"$exists": True, "$ne": None},
        "_id": {"$ne": ObjectId(invite.senderId)}
    }, {
        "_id": 1, "latitude": 1, "longitude": 1,
        "pushToken": 1, "notificationsEnabled": 1
    }).to_list(10000)

    invites_sent = 0
    notifications = []

    for user in users:
        distance = haversine_distance(
            invite.senderLatitude, invite.senderLongitude,
            user["latitude"], user["longitude"]
        )

        if distance <= invite.radius:
            notification = {
                "userId": str(user["_id"]),
                "type": "meetup_invite",
                "title": f"\U0001f697 Meetup Invite from {invite.senderName}!",
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

    if notifications:
        await db.notifications.insert_many(notifications)

    return {
        "message": f"Meetup invite sent to {invites_sent} nearby users",
        "invitesSent": invites_sent,
        "radius": invite.radius
    }


# ==================== Location Sharing (/locations) ====================

@router.post("/locations")
async def update_location(location: LocationUpdate):
    location_dict = location.dict()
    location_dict["updatedAt"] = datetime.utcnow().isoformat()

    await db.locations.update_one(
        {"userId": location.userId},
        {"$set": location_dict},
        upsert=True
    )

    return {"message": "Location updated successfully"}


@router.get("/locations/nearby/{user_id}")
async def get_nearby_users_by_location(user_id: str, radius: float = 50.0):
    user_location = await db.locations.find_one({"userId": user_id})
    if not user_location:
        return []

    user_lat = user_location["latitude"]
    user_lon = user_location["longitude"]

    locations = await db.locations.find({
        "isSharing": True,
        "userId": {"$ne": user_id}
    }).to_list(1000)

    nearby_locs = []
    for loc in locations:
        lat_diff = abs(loc["latitude"] - user_lat)
        lon_diff = abs(loc["longitude"] - user_lon)
        distance = ((lat_diff ** 2 + lon_diff ** 2) ** 0.5) * 69

        if distance <= radius:
            nearby_locs.append((loc, distance))

    # Batch fetch all nearby users in one query instead of N+1
    if nearby_locs:
        user_ids = [ObjectId(loc["userId"]) for loc, _ in nearby_locs]
        users_list = await db.users.find(
            {"_id": {"$in": user_ids}},
            {"_id": 1, "name": 1, "nickname": 1}
        ).to_list(len(user_ids))
        users_map = {str(u["_id"]): u for u in users_list}
    else:
        users_map = {}

    nearby_users = []
    for loc, distance in nearby_locs:
        user = users_map.get(loc["userId"])
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


@router.get("/locations/{user_id}")
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


@router.delete("/locations/{user_id}")
async def stop_sharing_location(user_id: str):
    await db.locations.update_one(
        {"userId": user_id},
        {"$set": {"isSharing": False}}
    )
    return {"message": "Location sharing stopped"}
