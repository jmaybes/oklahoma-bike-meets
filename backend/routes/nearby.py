from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timedelta
from bson import ObjectId

from database import db
from models import LocationUpdate, MeetupInviteRequest, PopupInviteRequest, PopupRsvpRequest
from helpers import haversine_distance, send_push_notification

router = APIRouter()

# Prewritten invite messages
PREWRITTEN_INVITES = [
    "Hey riders! I'm nearby and looking to meet up. Anyone want to cruise?",
    "Pop-up meet happening now! Come check out some rides in the area!",
    "Looking for fellow car lovers to hang out. Who's around?",
    "Spontaneous bike meet! Drop your location if you're interested!",
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


@router.post("/meetup/send-popup-invite")
async def send_popup_invite(invite: PopupInviteRequest):
    """Send pop-up event invites to specifically selected nearby users with optional location sharing."""
    if not ObjectId.is_valid(invite.senderId):
        raise HTTPException(status_code=400, detail="Invalid sender ID")

    if not invite.recipientIds or len(invite.recipientIds) == 0:
        raise HTTPException(status_code=400, detail="No recipients selected")

    sender = await db.users.find_one({"_id": ObjectId(invite.senderId)})
    if not sender:
        raise HTTPException(status_code=404, detail="Sender not found")

    # Cap location duration at 60 minutes
    duration_minutes = min(invite.locationDuration, 60)

    # If sharing location, create a location share record with expiry
    location_share_id = None
    if invite.shareLocation and invite.latitude is not None and invite.longitude is not None:
        expires_at = datetime.utcnow() + timedelta(minutes=duration_minutes)
        share_doc = {
            "userId": invite.senderId,
            "userName": invite.senderName,
            "latitude": invite.latitude,
            "longitude": invite.longitude,
            "expiresAt": expires_at.isoformat(),
            "createdAt": datetime.utcnow().isoformat(),
            "durationMinutes": duration_minutes,
            "isActive": True,
        }
        result = await db.location_shares.insert_one(share_doc)
        location_share_id = str(result.inserted_id)

    # Build the message content
    message_lines = [f"🏁 Pop-Up Event Invite from {invite.senderName}!"]
    if invite.shareLocation and invite.latitude is not None:
        message_lines.append(f"📍 Live location shared for {duration_minutes} min")
    if invite.message.strip():
        message_lines.append(f"\n{invite.message.strip()}")

    full_message = "\n".join(message_lines)

    invites_sent = 0
    now_iso = datetime.utcnow().isoformat()

    for rid in invite.recipientIds:
        if not ObjectId.is_valid(rid):
            continue

        # Create a message in the messages collection so it appears in chat
        msg_doc = {
            "senderId": invite.senderId,
            "recipientId": rid,
            "content": full_message,
            "isRead": False,
            "createdAt": now_iso,
            "isPopupInvite": True,
        }
        if location_share_id:
            msg_doc["locationShareId"] = location_share_id

        await db.messages.insert_one(msg_doc)

        # Send push notification
        recipient = await db.users.find_one(
            {"_id": ObjectId(rid)},
            {"pushToken": 1, "notificationsEnabled": 1}
        )
        if recipient and recipient.get("pushToken") and recipient.get("notificationsEnabled", True):
            try:
                await send_push_notification(
                    recipient["pushToken"],
                    f"🏁 Pop-Up Invite from {invite.senderName}!",
                    invite.message[:100] if invite.message else "You're invited to a pop-up bike meet!",
                    {
                        "type": "popup_invite",
                        "senderId": invite.senderId,
                        "locationShareId": location_share_id or "",
                    }
                )
            except Exception as e:
                print(f"Failed to send push notification to {rid}: {e}")

        invites_sent += 1

    return {
        "message": f"Pop-up invite sent to {invites_sent} users",
        "invitesSent": invites_sent,
        "locationShareId": location_share_id,
    }


@router.get("/meetup/location-share/{share_id}")
async def get_location_share(share_id: str):
    """Get a shared location by its ID. Returns 404 if expired or not found."""
    if not ObjectId.is_valid(share_id):
        raise HTTPException(status_code=400, detail="Invalid share ID")

    share = await db.location_shares.find_one({"_id": ObjectId(share_id)})
    if not share:
        raise HTTPException(status_code=404, detail="Location share not found")

    # Check expiry
    expires_at = datetime.fromisoformat(share["expiresAt"])
    if datetime.utcnow() > expires_at:
        # Mark as inactive
        await db.location_shares.update_one(
            {"_id": ObjectId(share_id)},
            {"$set": {"isActive": False}}
        )
        return {
            "id": share_id,
            "expired": True,
            "message": "This location share has expired"
        }

    remaining = (expires_at - datetime.utcnow()).total_seconds()
    return {
        "id": share_id,
        "expired": False,
        "userId": share["userId"],
        "userName": share.get("userName", ""),
        "latitude": share["latitude"],
        "longitude": share["longitude"],
        "durationMinutes": share.get("durationMinutes", 30),
        "remainingSeconds": int(remaining),
        "expiresAt": share["expiresAt"],
    }


# ==================== Pop-Up RSVP ====================

@router.post("/meetup/popup-rsvp")
async def rsvp_popup_invite(rsvp: PopupRsvpRequest):
    """RSVP to a pop-up event invite. Status: 'attending' or 'declined'."""
    if not ObjectId.is_valid(rsvp.messageId):
        raise HTTPException(status_code=400, detail="Invalid message ID")
    if rsvp.status not in ("attending", "declined"):
        raise HTTPException(status_code=400, detail="Status must be 'attending' or 'declined'")

    # Verify the message exists and is a popup invite
    message = await db.messages.find_one({"_id": ObjectId(rsvp.messageId)})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    if not message.get("isPopupInvite"):
        raise HTTPException(status_code=400, detail="This message is not a pop-up invite")

    # Upsert the RSVP (one per user per message)
    await db.popup_rsvps.update_one(
        {"messageId": rsvp.messageId, "userId": rsvp.userId},
        {"$set": {
            "messageId": rsvp.messageId,
            "userId": rsvp.userId,
            "userName": rsvp.userName,
            "status": rsvp.status,
            "updatedAt": datetime.utcnow().isoformat(),
        }},
        upsert=True,
    )

    # Notify the invite sender about the RSVP
    sender_id = message.get("senderId")
    if sender_id and sender_id != rsvp.userId:
        sender = await db.users.find_one(
            {"_id": ObjectId(sender_id)},
            {"pushToken": 1, "notificationsEnabled": 1}
        )
        status_emoji = "✅" if rsvp.status == "attending" else "❌"
        status_text = "will be there" if rsvp.status == "attending" else "can't make it"

        if sender and sender.get("pushToken") and sender.get("notificationsEnabled", True):
            try:
                await send_push_notification(
                    sender["pushToken"],
                    f"{status_emoji} RSVP: {rsvp.userName}",
                    f"{rsvp.userName} {status_text} for your pop-up event!",
                    {"type": "popup_rsvp", "messageId": rsvp.messageId, "status": rsvp.status}
                )
            except Exception as e:
                print(f"Failed to send RSVP notification: {e}")

    return {"status": rsvp.status, "message": f"RSVP recorded as {rsvp.status}"}


@router.get("/meetup/popup-rsvp/{message_id}")
async def get_popup_rsvps(message_id: str):
    """Get all RSVPs for a specific pop-up invite message."""
    if not ObjectId.is_valid(message_id):
        raise HTTPException(status_code=400, detail="Invalid message ID")

    rsvps = await db.popup_rsvps.find(
        {"messageId": message_id}
    ).to_list(500)

    return {
        "rsvps": [{
            "userId": r["userId"],
            "userName": r.get("userName", ""),
            "status": r["status"],
            "updatedAt": r.get("updatedAt", ""),
        } for r in rsvps],
        "attending": sum(1 for r in rsvps if r["status"] == "attending"),
        "declined": sum(1 for r in rsvps if r["status"] == "declined"),
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
