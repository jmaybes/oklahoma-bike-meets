from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from bson import ObjectId
import re
import httpx

from database import db
from models import UserCreate, UserLogin, UserUpdate, GoogleAuthRequest, GoogleAuthComplete, PushTokenRegister
from helpers import user_helper

router = APIRouter()


# ==================== Auth ====================

@router.post("/auth/register")
async def register_user(user: UserCreate):
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_dict = user.dict()
    user_dict["createdAt"] = datetime.utcnow().isoformat()
    user_dict["authProvider"] = "email"

    result = await db.users.insert_one(user_dict)
    created_user = await db.users.find_one({"_id": result.inserted_id})
    return user_helper(created_user)


@router.post("/auth/login")
async def login_user(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or user.get("password") != credentials.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return user_helper(user)


# ==================== Google OAuth ====================

@router.post("/auth/google/session")
async def google_auth_session(request: GoogleAuthRequest):
    """Exchange Google OAuth session_id for user data from Emergent Auth."""
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": request.session_id},
                timeout=30.0
            )

            if response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session ID")

            google_data = response.json()

            existing_user = await db.users.find_one({"email": google_data["email"]})

            if existing_user:
                return {
                    "isNewUser": False,
                    "user": user_helper(existing_user),
                    "googleData": {
                        "email": google_data["email"],
                        "name": google_data["name"],
                        "picture": google_data.get("picture", ""),
                        "googleId": google_data["id"]
                    }
                }
            else:
                return {
                    "isNewUser": True,
                    "user": None,
                    "googleData": {
                        "email": google_data["email"],
                        "name": google_data["name"],
                        "picture": google_data.get("picture", ""),
                        "googleId": google_data["id"]
                    }
                }

    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Failed to verify Google session: {str(e)}")


@router.post("/auth/google/complete")
async def google_auth_complete(data: GoogleAuthComplete):
    """Complete Google OAuth registration with custom username."""
    existing_user = await db.users.find_one({"email": data.email})
    if existing_user:
        return user_helper(existing_user)

    existing_nickname = await db.users.find_one({"nickname": data.nickname})
    if existing_nickname:
        raise HTTPException(status_code=400, detail="Username already taken")

    if len(data.nickname) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(data.nickname) > 20:
        raise HTTPException(status_code=400, detail="Username must be 20 characters or less")
    if not re.match(r'^[a-zA-Z0-9_]+$', data.nickname):
        raise HTTPException(status_code=400, detail="Username can only contain letters, numbers, and underscores")

    new_user = {
        "email": data.email,
        "name": data.name,
        "nickname": data.nickname,
        "password": "",
        "profilePic": data.picture,
        "googleId": data.googleId,
        "authProvider": "google",
        "isAdmin": False,
        "notificationsEnabled": True,
        "locationSharingEnabled": True,
        "createdAt": datetime.utcnow().isoformat()
    }

    result = await db.users.insert_one(new_user)
    created_user = await db.users.find_one({"_id": result.inserted_id})
    return user_helper(created_user)


@router.get("/auth/check-username/{nickname}")
async def check_username_available(nickname: str):
    """Check if a username is available"""
    existing = await db.users.find_one({"nickname": nickname})
    return {"available": existing is None}


# ==================== User Management ====================

@router.put("/users/{user_id}")
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


@router.post("/users/register-push-token")
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


@router.get("/users/search")
async def search_users(q: str = Query(..., min_length=1)):
    """Search for users by name, nickname, or email"""
    pattern = {"$regex": q, "$options": "i"}

    users = await db.users.find({
        "$or": [
            {"name": pattern},
            {"nickname": pattern},
            {"email": pattern}
        ]
    }).limit(20).to_list(20)

    return [
        {
            "id": str(user["_id"]),
            "name": user.get("name", ""),
            "nickname": user.get("nickname", ""),
            "email": user.get("email", "")
        }
        for user in users
    ]


@router.get("/users/{user_id}")
async def get_user(user_id: str):
    """Get user details by ID"""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": str(user["_id"]),
        "name": user.get("name", ""),
        "nickname": user.get("nickname", ""),
        "email": user.get("email", "")
    }
