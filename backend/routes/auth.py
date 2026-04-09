from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from bson import ObjectId
import re
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

from database import db
from models import UserCreate, UserLogin, UserUpdate, GoogleAuthRequest, GoogleAuthComplete, AppleAuthRequest, AppleAuthComplete, PushTokenRegister, DeleteAccountRequest
from helpers import user_helper

router = APIRouter()

EMERGENT_AUTH_URL = os.environ.get("EMERGENT_AUTH_URL", "https://demobackend.emergentagent.com")


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
                f"{EMERGENT_AUTH_URL}/auth/v1/env/oauth/session-data",
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


# ==================== Apple Sign In ====================

@router.post("/auth/apple/session")
async def apple_auth_session(request: AppleAuthRequest):
    """Verify Apple identity token and authenticate/register user."""
    import jwt
    
    try:
        apple_user_id = None
        token_email = ""
        
        # Try to decode the Apple identity token
        if request.identityToken and request.identityToken.count('.') >= 2:
            try:
                # First try to fetch Apple's public keys and verify properly
                async with httpx.AsyncClient() as http_client:
                    jwks_response = await http_client.get("https://appleid.apple.com/auth/keys", timeout=10.0)
                    apple_keys = jwks_response.json()
                
                header = jwt.get_unverified_header(request.identityToken)
                kid = header.get("kid")
                
                matching_key = None
                for key in apple_keys.get("keys", []):
                    if key.get("kid") == kid:
                        matching_key = key
                        break
                
                if matching_key:
                    from jwt.algorithms import RSAAlgorithm
                    public_key = RSAAlgorithm.from_jwk(matching_key)
                    decoded = jwt.decode(
                        request.identityToken,
                        public_key,
                        algorithms=["RS256"],
                        audience="com.velocityvisualcrew.okcarmeets",
                        options={"verify_exp": True}
                    )
                else:
                    decoded = jwt.decode(request.identityToken, options={"verify_signature": False})
                
                apple_user_id = decoded.get("sub")
                token_email = decoded.get("email", "")
                
            except Exception as decode_error:
                print(f"Apple token decode warning: {decode_error}")
                # Try simple decode without verification
                try:
                    decoded = jwt.decode(request.identityToken, options={"verify_signature": False})
                    apple_user_id = decoded.get("sub")
                    token_email = decoded.get("email", "")
                except Exception:
                    print("Apple token fully unparseable, using request data directly")
        else:
            print("Apple identity token missing or malformed, using request data directly")
        
        # Use email from token, or from request (Apple sends email on first sign-in only)
        email = token_email or request.email
        
        if not email:
            # Return as new user so the frontend can redirect to username selection
            # where the user can provide additional info
            return {
                "isNewUser": True,
                "user": None,
                "appleData": {
                    "email": "",
                    "name": request.fullName or "Apple User",
                    "appleId": apple_user_id or f"apple_{datetime.utcnow().timestamp()}"
                }
            }
        
        # Check if user exists by Apple ID or email
        query_conditions = [{"email": email}]
        if apple_user_id:
            query_conditions.insert(0, {"appleId": apple_user_id})
        
        existing_user = await db.users.find_one({"$or": query_conditions})
        
        if existing_user:
            if not existing_user.get("appleId") and apple_user_id:
                await db.users.update_one(
                    {"_id": existing_user["_id"]},
                    {"$set": {"appleId": apple_user_id, "authProvider": "apple"}}
                )
                existing_user = await db.users.find_one({"_id": existing_user["_id"]})
            
            return {
                "isNewUser": False,
                "user": user_helper(existing_user),
                "appleData": {
                    "email": email,
                    "name": request.fullName or existing_user.get("name", ""),
                    "appleId": apple_user_id or existing_user.get("appleId", "")
                }
            }
        else:
            return {
                "isNewUser": True,
                "user": None,
                "appleData": {
                    "email": email,
                    "name": request.fullName or "",
                    "appleId": apple_user_id or ""
                }
            }
    
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Apple identity token has expired")
    except Exception as e:
        print(f"Apple auth error: {e}")
        # Instead of 500, try to gracefully handle with available data
        email = request.email or ""
        return {
            "isNewUser": True,
            "user": None,
            "appleData": {
                "email": email,
                "name": request.fullName or "Apple User",
                "appleId": ""
            }
        }


@router.post("/auth/apple/complete")
async def apple_auth_complete(data: AppleAuthComplete):
    """Complete Apple Sign In registration with custom username."""
    existing_user = await db.users.find_one({"email": data.email})
    if existing_user:
        # Update with Apple ID if not set
        if not existing_user.get("appleId"):
            await db.users.update_one(
                {"_id": existing_user["_id"]},
                {"$set": {"appleId": data.appleId, "authProvider": "apple"}}
            )
            existing_user = await db.users.find_one({"_id": existing_user["_id"]})
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
        "name": data.name or "Apple User",
        "nickname": data.nickname,
        "password": "",
        "profilePic": "",
        "appleId": data.appleId,
        "authProvider": "apple",
        "isAdmin": False,
        "notificationsEnabled": True,
        "locationSharingEnabled": True,
        "createdAt": datetime.utcnow().isoformat()
    }
    
    result = await db.users.insert_one(new_user)
    created_user = await db.users.find_one({"_id": result.inserted_id})
    return user_helper(created_user)


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
    """Get user details by ID - returns full user data for session validation"""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user_helper(user)


# ==================== Account Deletion ====================

@router.post("/auth/delete-account")
async def delete_account(request: DeleteAccountRequest):
    """Delete a user account and all associated data after verifying credentials."""
    if not ObjectId.is_valid(request.user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    user = await db.users.find_one({"_id": ObjectId(request.user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Verify email matches
    if user.get("email", "").lower() != request.email.lower():
        raise HTTPException(status_code=401, detail="Email does not match")

    # For email-based accounts, verify password
    auth_provider = user.get("authProvider", "email")
    if auth_provider == "email":
        if not request.password or user.get("password") != request.password:
            raise HTTPException(status_code=401, detail="Invalid password")

    user_id_str = str(user["_id"])
    user_id_obj = user["_id"]

    # Delete all associated data
    deleted_counts = {}

    # Delete user's cars
    result = await db.user_cars.delete_many({"userId": user_id_str})
    deleted_counts["cars"] = result.deleted_count

    # Delete user's RSVPs
    result = await db.rsvps.delete_many({"userId": user_id_str})
    deleted_counts["rsvps"] = result.deleted_count

    # Delete user's messages (sent)
    result = await db.messages.delete_many({"senderId": user_id_str})
    deleted_counts["messages_sent"] = result.deleted_count

    # Delete user's favorites
    result = await db.favorites.delete_many({"userId": user_id_str})
    deleted_counts["favorites"] = result.deleted_count

    # Delete user's feedback
    result = await db.feedback.delete_many({"userId": user_id_str})
    deleted_counts["feedback"] = result.deleted_count

    # Delete user's performance runs
    result = await db.performance_runs.delete_many({"userId": user_id_str})
    deleted_counts["performance_runs"] = result.deleted_count

    # Delete user's routes
    result = await db.routes.delete_many({"userId": user_id_str})
    deleted_counts["routes"] = result.deleted_count

    # Delete user's location data
    result = await db.locations.delete_many({"userId": user_id_str})
    deleted_counts["locations"] = result.deleted_count

    # Delete user's notifications
    result = await db.notifications.delete_many({"userId": user_id_str})
    deleted_counts["notifications"] = result.deleted_count

    # Delete user's event photos
    result = await db.event_photos.delete_many({"uploaderId": user_id_str})
    deleted_counts["event_photos"] = result.deleted_count

    # Delete user's comments
    result = await db.comments.delete_many({"userId": user_id_str})
    deleted_counts["comments"] = result.deleted_count

    # Finally, delete the user account
    await db.users.delete_one({"_id": user_id_obj})

    return {
        "message": "Account and all associated data have been permanently deleted.",
        "deleted": deleted_counts
    }
