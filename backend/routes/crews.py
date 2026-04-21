from fastapi import APIRouter, HTTPException, Header
from datetime import datetime
from bson import ObjectId
from typing import Optional
import logging
import jwt
import os

from database import db
from helpers import send_push_notification

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/crews", tags=["crews"])

JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")


def verify_token(authorization: str = Header(...)):
    """Extract user ID from JWT token"""
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload.get("user_id") or payload.get("userId")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


# ==================== CREW CRUD ====================

@router.post("")
async def create_crew(data: dict, authorization: str = Header(...)):
    """Create a new crew. Each user can only create ONE crew."""
    user_id = verify_token(authorization)

    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Crew name is required")
    if len(name) > 30:
        raise HTTPException(status_code=400, detail="Crew name must be 30 characters or less")

    # Check if user already created a crew
    existing = await db.crews.find_one({"creatorId": user_id})
    if existing:
        raise HTTPException(status_code=400, detail="You can only create one crew")

    # Check for duplicate crew name
    name_exists = await db.crews.find_one({"name": {"$regex": f"^{name}$", "$options": "i"}})
    if name_exists:
        raise HTTPException(status_code=400, detail="A crew with that name already exists")

    crew = {
        "name": name,
        "creatorId": user_id,
        "coLeaders": [],  # Co-leaders can invite and kick regular members
        "members": [user_id],  # Creator is automatically a member
        "createdAt": datetime.utcnow().isoformat(),
        "updatedAt": datetime.utcnow().isoformat(),
    }

    result = await db.crews.insert_one(crew)
    crew["_id"] = str(result.inserted_id)
    crew["id"] = crew["_id"]

    logger.info(f"Crew '{name}' created by user {user_id}")
    return {"message": "Crew created successfully", "crew": crew}


@router.get("/{crew_id}")
async def get_crew(crew_id: str):
    """Get crew details with full member info"""
    try:
        crew = await db.crews.find_one({"_id": ObjectId(crew_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid crew ID")

    if not crew:
        raise HTTPException(status_code=404, detail="Crew not found")

    # Fetch member details
    co_leaders = crew.get("coLeaders", [])
    members = []
    for member_id in crew.get("members", []):
        try:
            user = await db.users.find_one(
                {"_id": ObjectId(member_id)},
                {"name": 1, "nickname": 1, "email": 1}
            )
            if user:
                # Get member's bike count
                bike_count = await db.user_cars.count_documents({"userId": member_id, "isPublic": True})
                members.append({
                    "id": str(user["_id"]),
                    "name": user.get("name", "Unknown"),
                    "nickname": user.get("nickname", ""),
                    "bikeCount": bike_count,
                    "isCreator": member_id == crew["creatorId"],
                    "isCoLeader": member_id in co_leaders,
                    "role": "Creator" if member_id == crew["creatorId"] else ("Co-Leader" if member_id in co_leaders else "Member"),
                })
        except Exception:
            continue

    return {
        "id": str(crew["_id"]),
        "name": crew["name"],
        "creatorId": crew["creatorId"],
        "coLeaders": co_leaders,
        "members": members,
        "memberCount": len(members),
        "createdAt": crew.get("createdAt"),
    }


@router.get("/user/{user_id}")
async def get_user_crews(user_id: str):
    """Get all crews a user belongs to"""
    crews = await db.crews.find(
        {"members": user_id}
    ).to_list(50)

    result = []
    for crew in crews:
        result.append({
            "id": str(crew["_id"]),
            "name": crew["name"],
            "creatorId": crew["creatorId"],
            "memberCount": len(crew.get("members", [])),
            "isCreator": crew["creatorId"] == user_id,
        })

    return result


@router.get("/created/{user_id}")
async def get_created_crew(user_id: str):
    """Get the crew a user created (if any)"""
    crew = await db.crews.find_one({"creatorId": user_id})
    if not crew:
        return None

    return {
        "id": str(crew["_id"]),
        "name": crew["name"],
        "creatorId": crew["creatorId"],
        "memberCount": len(crew.get("members", [])),
    }


@router.put("/{crew_id}")
async def update_crew(crew_id: str, data: dict, authorization: str = Header(...)):
    """Update crew name (creator only)"""
    user_id = verify_token(authorization)

    try:
        crew = await db.crews.find_one({"_id": ObjectId(crew_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid crew ID")

    if not crew:
        raise HTTPException(status_code=404, detail="Crew not found")
    if crew["creatorId"] != user_id:
        raise HTTPException(status_code=403, detail="Only the crew creator can update it")

    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Crew name is required")
    if len(name) > 30:
        raise HTTPException(status_code=400, detail="Crew name must be 30 characters or less")

    # Check for duplicate name (excluding current crew)
    name_exists = await db.crews.find_one({
        "name": {"$regex": f"^{name}$", "$options": "i"},
        "_id": {"$ne": ObjectId(crew_id)}
    })
    if name_exists:
        raise HTTPException(status_code=400, detail="A crew with that name already exists")

    await db.crews.update_one(
        {"_id": ObjectId(crew_id)},
        {"$set": {"name": name, "updatedAt": datetime.utcnow().isoformat()}}
    )

    return {"message": "Crew updated successfully"}


@router.delete("/{crew_id}")
async def delete_crew(crew_id: str, authorization: str = Header(...)):
    """Delete a crew (creator only)"""
    user_id = verify_token(authorization)

    try:
        crew = await db.crews.find_one({"_id": ObjectId(crew_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid crew ID")

    if not crew:
        raise HTTPException(status_code=404, detail="Crew not found")
    if crew["creatorId"] != user_id:
        raise HTTPException(status_code=403, detail="Only the crew creator can delete it")

    # Delete crew and all related invites
    await db.crews.delete_one({"_id": ObjectId(crew_id)})
    await db.crew_invites.delete_many({"crewId": crew_id})

    logger.info(f"Crew '{crew['name']}' deleted by {user_id}")
    return {"message": "Crew deleted successfully"}


# ==================== INVITES ====================

@router.post("/{crew_id}/invite/{target_user_id}")
async def invite_to_crew(crew_id: str, target_user_id: str, authorization: str = Header(...)):
    """Send a crew invite to another user"""
    user_id = verify_token(authorization)

    # Validate crew
    try:
        crew = await db.crews.find_one({"_id": ObjectId(crew_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid crew ID")

    if not crew:
        raise HTTPException(status_code=404, detail="Crew not found")

    # Only crew creator or co-leaders can invite
    co_leaders = crew.get("coLeaders", [])
    if user_id != crew["creatorId"] and user_id not in co_leaders:
        raise HTTPException(status_code=403, detail="Only the crew creator or co-leaders can send invites")

    # Check target user exists
    try:
        target_user = await db.users.find_one({"_id": ObjectId(target_user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if already a member
    if target_user_id in crew.get("members", []):
        raise HTTPException(status_code=400, detail="User is already a member of this crew")

    # Check for existing pending invite
    existing_invite = await db.crew_invites.find_one({
        "crewId": crew_id,
        "toUserId": target_user_id,
        "status": "pending"
    })
    if existing_invite:
        raise HTTPException(status_code=400, detail="An invite is already pending for this user")

    # Get sender info
    sender = await db.users.find_one({"_id": ObjectId(user_id)})
    sender_name = sender.get("nickname") or sender.get("name", "Someone") if sender else "Someone"

    # Create invite
    invite = {
        "crewId": crew_id,
        "crewName": crew["name"],
        "fromUserId": user_id,
        "fromUserName": sender_name,
        "toUserId": target_user_id,
        "status": "pending",
        "createdAt": datetime.utcnow().isoformat(),
        "updatedAt": datetime.utcnow().isoformat(),
    }

    result = await db.crew_invites.insert_one(invite)

    # Create in-app notification
    notification = {
        "userId": target_user_id,
        "type": "crew_invite",
        "title": "Crew Invite!",
        "message": f"{sender_name} invited you to join '{crew['name']}'",
        "crewId": crew_id,
        "inviteId": str(result.inserted_id),
        "isRead": False,
        "createdAt": datetime.utcnow().isoformat(),
    }
    await db.notifications.insert_one(notification)

    # Send push notification
    if target_user.get("pushToken") and target_user.get("notificationsEnabled", True):
        try:
            await send_push_notification(
                target_user["pushToken"],
                "Crew Invite! 🏎️",
                f"{sender_name} invited you to join '{crew['name']}'",
                {"type": "crew_invite", "crewId": crew_id, "inviteId": str(result.inserted_id)}
            )
        except Exception as e:
            logger.error(f"Failed to send crew invite push: {e}")

    logger.info(f"Crew invite sent: {user_id} -> {target_user_id} for crew '{crew['name']}'")
    return {"message": "Invite sent successfully"}


@router.get("/invites/pending/{user_id}")
async def get_pending_invites(user_id: str):
    """Get all pending crew invites for a user"""
    invites = await db.crew_invites.find(
        {"toUserId": user_id, "status": "pending"}
    ).sort("createdAt", -1).to_list(50)

    result = []
    for invite in invites:
        result.append({
            "id": str(invite["_id"]),
            "crewId": invite["crewId"],
            "crewName": invite["crewName"],
            "fromUserId": invite["fromUserId"],
            "fromUserName": invite["fromUserName"],
            "createdAt": invite["createdAt"],
        })

    return result


@router.put("/invites/{invite_id}/accept")
async def accept_invite(invite_id: str, authorization: str = Header(...)):
    """Accept a crew invite"""
    user_id = verify_token(authorization)

    try:
        invite = await db.crew_invites.find_one({"_id": ObjectId(invite_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid invite ID")

    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite["toUserId"] != user_id:
        raise HTTPException(status_code=403, detail="This invite is not for you")
    if invite["status"] != "pending":
        raise HTTPException(status_code=400, detail="Invite is no longer pending")

    # Add user to crew members
    await db.crews.update_one(
        {"_id": ObjectId(invite["crewId"])},
        {
            "$addToSet": {"members": user_id},
            "$set": {"updatedAt": datetime.utcnow().isoformat()}
        }
    )

    # Update invite status
    await db.crew_invites.update_one(
        {"_id": ObjectId(invite_id)},
        {"$set": {"status": "accepted", "updatedAt": datetime.utcnow().isoformat()}}
    )

    # Notify the crew creator
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    user_name = user.get("nickname") or user.get("name", "Someone") if user else "Someone"

    crew = await db.crews.find_one({"_id": ObjectId(invite["crewId"])})
    if crew:
        creator = await db.users.find_one({"_id": ObjectId(crew["creatorId"])})
        if creator:
            accept_notification = {
                "userId": crew["creatorId"],
                "type": "crew_accepted",
                "title": "New Crew Member! 🎉",
                "message": f"{user_name} joined your crew '{crew['name']}'",
                "crewId": invite["crewId"],
                "isRead": False,
                "createdAt": datetime.utcnow().isoformat(),
            }
            await db.notifications.insert_one(accept_notification)

            if creator.get("pushToken") and creator.get("notificationsEnabled", True):
                try:
                    await send_push_notification(
                        creator["pushToken"],
                        "New Crew Member! 🎉",
                        f"{user_name} joined your crew '{crew['name']}'",
                        {"type": "crew_accepted", "crewId": invite["crewId"]}
                    )
                except Exception as e:
                    logger.error(f"Failed to send crew accept push: {e}")

    logger.info(f"User {user_id} accepted invite to crew '{invite['crewName']}'")
    return {"message": f"You joined '{invite['crewName']}'!"}


@router.put("/invites/{invite_id}/decline")
async def decline_invite(invite_id: str, authorization: str = Header(...)):
    """Decline a crew invite"""
    user_id = verify_token(authorization)

    try:
        invite = await db.crew_invites.find_one({"_id": ObjectId(invite_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid invite ID")

    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite["toUserId"] != user_id:
        raise HTTPException(status_code=403, detail="This invite is not for you")
    if invite["status"] != "pending":
        raise HTTPException(status_code=400, detail="Invite is no longer pending")

    await db.crew_invites.update_one(
        {"_id": ObjectId(invite_id)},
        {"$set": {"status": "declined", "updatedAt": datetime.utcnow().isoformat()}}
    )

    logger.info(f"User {user_id} declined invite to crew '{invite['crewName']}'")
    return {"message": "Invite declined"}


# ==================== MEMBER MANAGEMENT ====================

@router.delete("/{crew_id}/members/{member_id}")
async def remove_member(crew_id: str, member_id: str, authorization: str = Header(...)):
    """Remove a member from crew (creator/co-leader) or leave crew (self)"""
    user_id = verify_token(authorization)

    try:
        crew = await db.crews.find_one({"_id": ObjectId(crew_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid crew ID")

    if not crew:
        raise HTTPException(status_code=404, detail="Crew not found")

    co_leaders = crew.get("coLeaders", [])

    # Creator can't leave their own crew (must delete it)
    if member_id == crew["creatorId"] and user_id == member_id:
        raise HTTPException(status_code=400, detail="Crew creator cannot leave. Delete the crew instead.")

    # Co-leaders can't be kicked by other co-leaders, only by creator
    if member_id in co_leaders and user_id != crew["creatorId"] and user_id != member_id:
        raise HTTPException(status_code=403, detail="Only the crew creator can remove co-leaders")

    # Creator and co-leaders can kick regular members, or user can leave themselves
    is_creator = user_id == crew["creatorId"]
    is_co_leader = user_id in co_leaders
    is_self = user_id == member_id
    if not is_creator and not is_co_leader and not is_self:
        raise HTTPException(status_code=403, detail="Only the crew creator or co-leaders can remove members")

    if member_id not in crew.get("members", []):
        raise HTTPException(status_code=400, detail="User is not a member of this crew")

    # Also remove from co-leaders if they were one
    update_ops = {
        "$pull": {"members": member_id, "coLeaders": member_id},
        "$set": {"updatedAt": datetime.utcnow().isoformat()}
    }
    await db.crews.update_one({"_id": ObjectId(crew_id)}, update_ops)

    action = "left" if user_id == member_id else "was removed from"
    logger.info(f"User {member_id} {action} crew '{crew['name']}'")
    return {"message": f"Successfully {'left' if user_id == member_id else 'removed member from'} the crew"}


# ==================== CO-LEADER MANAGEMENT ====================

@router.put("/{crew_id}/co-leader/{member_id}")
async def promote_to_co_leader(crew_id: str, member_id: str, authorization: str = Header(...)):
    """Promote a member to co-leader (creator only)"""
    user_id = verify_token(authorization)

    try:
        crew = await db.crews.find_one({"_id": ObjectId(crew_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid crew ID")

    if not crew:
        raise HTTPException(status_code=404, detail="Crew not found")
    if crew["creatorId"] != user_id:
        raise HTTPException(status_code=403, detail="Only the crew creator can promote co-leaders")
    if member_id == crew["creatorId"]:
        raise HTTPException(status_code=400, detail="The creator is already the leader")
    if member_id not in crew.get("members", []):
        raise HTTPException(status_code=400, detail="User is not a member of this crew")
    if member_id in crew.get("coLeaders", []):
        raise HTTPException(status_code=400, detail="User is already a co-leader")

    await db.crews.update_one(
        {"_id": ObjectId(crew_id)},
        {
            "$addToSet": {"coLeaders": member_id},
            "$set": {"updatedAt": datetime.utcnow().isoformat()}
        }
    )

    # Notify the promoted member
    member = await db.users.find_one({"_id": ObjectId(member_id)})
    if member:
        notification = {
            "userId": member_id,
            "type": "crew_promoted",
            "title": "You're a Co-Leader! ⭐",
            "message": f"You've been promoted to co-leader of '{crew['name']}'",
            "crewId": crew_id,
            "isRead": False,
            "createdAt": datetime.utcnow().isoformat(),
        }
        await db.notifications.insert_one(notification)

        if member.get("pushToken") and member.get("notificationsEnabled", True):
            try:
                await send_push_notification(
                    member["pushToken"],
                    "You're a Co-Leader! ⭐",
                    f"You've been promoted to co-leader of '{crew['name']}'",
                    {"type": "crew_promoted", "crewId": crew_id}
                )
            except Exception as e:
                logger.error(f"Failed to send co-leader promotion push: {e}")

    logger.info(f"User {member_id} promoted to co-leader of crew '{crew['name']}'")
    return {"message": "Member promoted to co-leader"}


@router.delete("/{crew_id}/co-leader/{member_id}")
async def demote_co_leader(crew_id: str, member_id: str, authorization: str = Header(...)):
    """Remove co-leader status from a member (creator only)"""
    user_id = verify_token(authorization)

    try:
        crew = await db.crews.find_one({"_id": ObjectId(crew_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid crew ID")

    if not crew:
        raise HTTPException(status_code=404, detail="Crew not found")
    if crew["creatorId"] != user_id:
        raise HTTPException(status_code=403, detail="Only the crew creator can demote co-leaders")
    if member_id not in crew.get("coLeaders", []):
        raise HTTPException(status_code=400, detail="User is not a co-leader")

    await db.crews.update_one(
        {"_id": ObjectId(crew_id)},
        {
            "$pull": {"coLeaders": member_id},
            "$set": {"updatedAt": datetime.utcnow().isoformat()}
        }
    )

    logger.info(f"User {member_id} demoted from co-leader of crew '{crew['name']}'")
    return {"message": "Co-leader status removed"}
