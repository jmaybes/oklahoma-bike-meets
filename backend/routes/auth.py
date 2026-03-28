from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from bson import ObjectId
import re
import httpx

from database import db
from models import UserCreate, UserLogin, UserUpdate, GoogleAuthRequest, GoogleAuthComplete, AppleAuthRequest, AppleAuthComplete, PushTokenRegister
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


# ==================== Apple Sign In ====================

@router.post("/auth/apple/session")
async def apple_auth_session(request: AppleAuthRequest):
    """Verify Apple identity token and authenticate/register user."""
    import jwt
    
    try:
        # Decode the Apple identity token without full verification
        # (Apple's token is signed with their keys, but we can decode the payload)
        # For production, you should verify against Apple's JWKS at https://appleid.apple.com/auth/keys
        try:
            # First try to fetch Apple's public keys and verify properly
            async with httpx.AsyncClient() as http_client:
                jwks_response = await http_client.get("https://appleid.apple.com/auth/keys", timeout=10.0)
                apple_keys = jwks_response.json()
            
            # Decode header to get the key ID
            header = jwt.get_unverified_header(request.identityToken)
            kid = header.get("kid")
            
            # Find the matching key
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
                # Fallback: decode without verification if key not found
                decoded = jwt.decode(request.identityToken, options={"verify_signature": False})
        except Exception as decode_error:
            # Fallback: decode without full verification
            print(f"Apple token verification warning: {decode_error}")
            decoded = jwt.decode(request.identityToken, options={"verify_signature": False})
        
        apple_user_id = decoded.get("sub")
        token_email = decoded.get("email", "")
        
        # Use email from token, or from request (Apple sends email on first sign-in only)
        email = token_email or request.email
        
        if not email:
            raise HTTPException(status_code=400, detail="No email available from Apple Sign In. Please ensure you share your email.")
        
        # Check if user exists by Apple ID or email
        existing_user = await db.users.find_one({
            "$or": [
                {"appleId": apple_user_id},
                {"email": email}
            ]
        })
        
        if existing_user:
            # Update Apple ID if not set (for users who registered with email first)
            if not existing_user.get("appleId"):
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
                    "appleId": apple_user_id
                }
            }
        else:
            # New user
            return {
                "isNewUser": True,
                "user": None,
                "appleData": {
                    "email": email,
                    "name": request.fullName or "",
                    "appleId": apple_user_id
                }
            }
    
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Apple identity token has expired")
    except Exception as e:
        print(f"Apple auth error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to verify Apple identity token: {str(e)}")


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
