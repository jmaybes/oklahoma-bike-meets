from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import Response
from typing import Optional
from pydantic import BaseModel
from datetime import datetime
from bson import ObjectId
from pymongo.errors import DocumentTooLarge
import base64
import os

from database import db
from models import UserCarCreate, UserCarUpdate, GarageCommentCreate
from helpers import user_car_helper, compress_photos_list, compress_photo_base64, make_thumbnail_base64, MAX_PHOTO_SIZE_BYTES, _sid, _isodate

import logging
logger = logging.getLogger(__name__)

router = APIRouter()


def get_base_url(request: Request) -> str:
    """
    Reliably construct the public base URL from request headers.
    Falls back to EXPO_PUBLIC_BACKEND_URL env var if headers are missing.
    This prevents broken photo URLs on native deployments behind proxies.
    """
    forwarded = request.headers.get("x-forwarded-host") or request.headers.get("host")
    scheme = request.headers.get("x-forwarded-proto", "https")
    
    if forwarded and "localhost" not in forwarded and "0.0.0.0" not in forwarded:
        return f"{scheme}://{forwarded}"
    
    # Fallback to env var (set by deployment process)
    env_url = os.environ.get("PUBLIC_BASE_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    if env_url:
        return env_url.rstrip("/")
    
    return str(request.base_url).rstrip("/")


# Get the public backend URL for generating image URLs
BACKEND_URL = os.environ.get("BACKEND_PUBLIC_URL", "")

# 1x1 gray placeholder JPEG (prevents 404/500 from breaking the app)
PLACEHOLDER_JPEG = base64.b64decode("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=")

@router.get("/user-cars/{car_id}/thumbnail.jpg")
async def get_car_thumbnail(car_id: str):
    """Serve a car's thumbnail as an actual JPEG image."""
    if not ObjectId.is_valid(car_id):
        return Response(content=PLACEHOLDER_JPEG, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=60"})
    
    car = await db.user_cars.find_one(
        {"_id": ObjectId(car_id)},
        {"thumbnail": 1}
    )
    if not car or not car.get("thumbnail"):
        return Response(content=PLACEHOLDER_JPEG, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=60"})
    
    thumb = car["thumbnail"]
    if "," in thumb:
        thumb = thumb.split(",", 1)[1]
    
    try:
        image_bytes = base64.b64decode(thumb)
    except Exception:
        return Response(content=PLACEHOLDER_JPEG, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=60"})
    
    return Response(
        content=image_bytes,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"}
    )


@router.get("/user-cars/{car_id}/photo/{index}/image.jpg")
async def get_car_photo_image(car_id: str, index: int):
    """Serve a single full-size car photo as an actual JPEG image."""
    if not ObjectId.is_valid(car_id):
        return Response(content=PLACEHOLDER_JPEG, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=60"})
    
    photo_doc = await db.user_cars.find_one(
        {"_id": ObjectId(car_id)},
        {"photos": {"$slice": [index, 1]}, "_id": 0}
    )
    
    if not photo_doc or not photo_doc.get("photos"):
        return Response(content=PLACEHOLDER_JPEG, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=60"})
    
    photo = photo_doc["photos"][0] if photo_doc["photos"] else None
    if not photo or len(str(photo)) < 100:
        return Response(content=PLACEHOLDER_JPEG, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=60"})
    
    # Skip URL-type photos
    if photo.startswith("http"):
        return Response(content=PLACEHOLDER_JPEG, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=60"})
    
    # Strip data URI prefix if present
    if "," in photo and photo.startswith("data:"):
        photo = photo.split(",", 1)[1]
    
    try:
        image_bytes = base64.b64decode(photo)
    except Exception:
        return Response(content=PLACEHOLDER_JPEG, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=60"})
    
    return Response(
        content=image_bytes,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=3600"}
    )



class SinglePhotoUpload(BaseModel):
    photo: str  # single base64 photo


class PhotoRemoveRequest(BaseModel):
    index: int


@router.post("/user-cars")
async def create_user_car(car: UserCarCreate):
    car_dict = car.dict()
    car_dict["likes"] = 0
    car_dict["views"] = 0
    car_dict["createdAt"] = datetime.utcnow().isoformat()

    # Compress photos to prevent DocumentTooLarge errors
    if car_dict.get("photos"):
        car_dict["photos"] = compress_photos_list(car_dict["photos"])

        # Validate total document size won't exceed 15MB MongoDB limit
        MAX_DOC_SIZE = 15 * 1024 * 1024
        total_photo_bytes = sum(len(p.encode('utf-8')) if isinstance(p, str) else 0 for p in car_dict["photos"])
        if total_photo_bytes + 2048 > MAX_DOC_SIZE:
            from helpers import compress_photo_base64
            import io as _io
            import base64 as _b64
            from PIL import Image as _Img
            for quality in [50, 35, 20]:
                recompressed = []
                for photo in car_dict["photos"]:
                    try:
                        raw = photo.split(',', 1)[-1] if ',' in photo and photo.startswith('data:') else photo
                        img_bytes = _b64.b64decode(raw)
                        img = _Img.open(_io.BytesIO(img_bytes))
                        if img.mode in ('RGBA', 'P'):
                            img = img.convert('RGB')
                        w, h = img.size
                        max_dim = 800 if quality <= 35 else 1000
                        if w > max_dim or h > max_dim:
                            ratio = min(max_dim / w, max_dim / h)
                            img = img.resize((int(w * ratio), int(h * ratio)), _Img.LANCZOS)
                        buf = _io.BytesIO()
                        img.save(buf, format='JPEG', quality=quality, optimize=True)
                        compressed = _b64.b64encode(buf.getvalue()).decode('utf-8')
                        recompressed.append(f"data:image/jpeg;base64,{compressed}")
                    except Exception:
                        recompressed.append(photo)
                car_dict["photos"] = recompressed
                total_photo_bytes = sum(len(p.encode('utf-8')) for p in recompressed)
                if total_photo_bytes + 2048 <= MAX_DOC_SIZE:
                    break
            # Strip excess photos as last resort
            total_photo_bytes = sum(len(p.encode('utf-8')) for p in car_dict["photos"])
            if total_photo_bytes + 2048 > MAX_DOC_SIZE:
                kept = []
                running_size = 2048
                for photo in car_dict["photos"]:
                    photo_size = len(photo.encode('utf-8'))
                    if running_size + photo_size <= MAX_DOC_SIZE:
                        kept.append(photo)
                        running_size += photo_size
                    else:
                        break
                car_dict["photos"] = kept

    existing = await db.user_cars.find_one({"userId": car.userId})
    if existing:
        try:
            await db.user_cars.update_one(
                {"_id": existing["_id"]},
                {"$set": {**car_dict, "updatedAt": datetime.utcnow().isoformat()}}
            )
        except DocumentTooLarge:
            raise HTTPException(status_code=413, detail="Photos are too large. Please use fewer or smaller images.")
        updated_car = await db.user_cars.find_one({"_id": existing["_id"]})
        return user_car_helper(updated_car)

    try:
        result = await db.user_cars.insert_one(car_dict)
    except DocumentTooLarge:
        raise HTTPException(status_code=413, detail="Photos are too large. Please use fewer or smaller images.")
    created_car = await db.user_cars.find_one({"_id": result.inserted_id})
    return user_car_helper(created_car)


@router.get("/user-cars/user/{user_id}")
async def get_user_car(request: Request, user_id: str, include_photos: bool = Query(default=False)):
    """Get a user's ACTIVE car. Returns HTTP thumbnail URLs instead of base64."""
    
    # Build base URL from request
    base_url = get_base_url(request)
    
    # Find the active car (or the first car if none is marked active)
    car = await db.user_cars.find_one({"userId": user_id, "isActive": True})
    if not car:
        # Fallback: find any car for this user (backwards compatibility)
        car = await db.user_cars.find_one({"userId": user_id})
    
    if not car:
        return None
    
    if include_photos:
        result = user_car_helper(car)
        result["photoCount"] = len(car.get("photos", []))
        car_id = result["id"]
        has_thumbnail = car.get("thumbnail", "")
        result["photos"] = [f"{base_url}/api/user-cars/{car_id}/thumbnail.jpg"] if has_thumbnail else []
        # Add owner info
        owner = await db.users.find_one({"_id": ObjectId(user_id)}, {"name": 1, "nickname": 1}) if ObjectId.is_valid(user_id) else None
        result["ownerName"] = owner.get("name", "Unknown") if owner else "Unknown"
        result["ownerNickname"] = owner.get("nickname", "") if owner else ""
        return result
    
    car_data = user_car_helper(car)
    car_id = car_data["id"]
    
    # Get photo count without loading photos
    count_doc = await db.user_cars.aggregate([
        {"$match": {"_id": car["_id"]}},
        {"$project": {"photoCount": {"$size": {"$ifNull": ["$photos", []]}}}}
    ]).to_list(1)
    photo_count = count_doc[0]["photoCount"] if count_doc else 0
    
    has_thumbnail = car.get("thumbnail", "")
    car_data["photos"] = [f"{base_url}/api/user-cars/{car_id}/thumbnail.jpg"] if has_thumbnail else []
    car_data["photoCount"] = photo_count
    car_data["mainPhotoIndex"] = 0
    # Add owner info
    owner = await db.users.find_one({"_id": ObjectId(user_id)}, {"name": 1, "nickname": 1}) if ObjectId.is_valid(user_id) else None
    car_data["ownerName"] = owner.get("name", "Unknown") if owner else "Unknown"
    car_data["ownerNickname"] = owner.get("nickname", "") if owner else ""
    return car_data


@router.get("/user-cars/user/{user_id}/all")
async def get_user_all_cars(request: Request, user_id: str):
    """Get ALL cars for a user (max 2). Used for car picker modal."""
    base_url = get_base_url(request)
    
    cars = await db.user_cars.find({"userId": user_id}, {"photos": 0}).to_list(10)
    if not cars:
        return []
    
    result = []
    for car in cars:
        car_data = user_car_helper(car)
        car_id = car_data["id"]
        has_thumbnail = car.get("thumbnail", "")
        car_data["thumbnailUrl"] = f"{base_url}/api/user-cars/{car_id}/thumbnail.jpg" if has_thumbnail else ""
        car_data["isActive"] = car.get("isActive", True)
        
        # Get photo count
        count_doc = await db.user_cars.aggregate([
            {"$match": {"_id": car["_id"]}},
            {"$project": {"photoCount": {"$size": {"$ifNull": ["$photos", []]}}}}
        ]).to_list(1)
        car_data["photoCount"] = count_doc[0]["photoCount"] if count_doc else 0
        result.append(car_data)
    
    # Add owner info
    owner = await db.users.find_one({"_id": ObjectId(user_id)}, {"name": 1, "nickname": 1}) if ObjectId.is_valid(user_id) else None
    owner_name = owner.get("name", "Unknown") if owner else "Unknown"
    owner_nickname = owner.get("nickname", "") if owner else ""
    for car_data in result:
        car_data["ownerName"] = owner_name
        car_data["ownerNickname"] = owner_nickname
    
    return result


@router.put("/user-cars/{car_id}/set-active")
async def set_active_car(car_id: str):
    """Set a car as the active/displayed car. Deactivates all other cars for that user."""
    if not ObjectId.is_valid(car_id):
        raise HTTPException(status_code=400, detail="Invalid car ID")
    
    car = await db.user_cars.find_one({"_id": ObjectId(car_id)})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    
    user_id = car["userId"]
    
    # Deactivate all cars for this user
    await db.user_cars.update_many({"userId": user_id}, {"$set": {"isActive": False}})
    
    # Activate the selected car
    await db.user_cars.update_one({"_id": ObjectId(car_id)}, {"$set": {"isActive": True}})
    
    return {"message": "Car set as active", "carId": car_id}


@router.get("/user-cars/public")
async def get_public_garages(
    request: Request,
    make: Optional[str] = None,
    limit: int = Query(default=50, le=100),
    sort: str = Query(default="random", description="Sort by: likes, views, newest, random")
):
    """Get all public garages with HTTP thumbnail URLs instead of base64."""
    query = {"$or": [{"isPublic": True}, {"isPublic": "true"}]}
    if make:
        query["make"] = {"$regex": make, "$options": "i"}

    if sort == "random":
        # Top 3 by likes stay fixed, rest is randomized
        # Use $cond + $isArray to survive corrupted non-array photos fields
        top3 = await db.user_cars.aggregate([
            {"$match": query},
            {"$addFields": {
                "_photoCount": {"$cond": {
                    "if": {"$isArray": "$photos"},
                    "then": {"$size": "$photos"},
                    "else": 0
                }},
                "_hasThumbnail": {"$cond": {
                    "if": {"$and": [{"$ne": ["$thumbnail", None]}, {"$ne": ["$thumbnail", ""]}]},
                    "then": True,
                    "else": False
                }}
            }},
            {"$project": {"photos": 0, "thumbnail": 0}},
            {"$sort": {"likes": -1}},
            {"$limit": 3}
        ]).to_list(3)
        top3_ids = [car["_id"] for car in top3]
        
        rest_query = {**query, "_id": {"$nin": top3_ids}}
        pipeline = [
            {"$match": rest_query},
            {"$addFields": {
                "_photoCount": {"$cond": {
                    "if": {"$isArray": "$photos"},
                    "then": {"$size": "$photos"},
                    "else": 0
                }},
                "_hasThumbnail": {"$cond": {
                    "if": {"$and": [{"$ne": ["$thumbnail", None]}, {"$ne": ["$thumbnail", ""]}]},
                    "then": True,
                    "else": False
                }}
            }},
            {"$project": {"photos": 0, "thumbnail": 0}},
            {"$sample": {"size": max(limit - 3, 0)}}
        ]
        rest = await db.user_cars.aggregate(pipeline).to_list(max(limit - 3, 0))
        cars = top3 + rest
    else:
        if sort == "views":
            sort_field = {"views": -1, "likes": -1}
        elif sort == "newest":
            sort_field = {"createdAt": -1}
        else:
            sort_field = {"likes": -1, "views": -1}

        cars = await db.user_cars.aggregate([
            {"$match": query},
            {"$addFields": {
                "_photoCount": {"$cond": {
                    "if": {"$isArray": "$photos"},
                    "then": {"$size": "$photos"},
                    "else": 0
                }},
                "_hasThumbnail": {"$cond": {
                    "if": {"$and": [{"$ne": ["$thumbnail", None]}, {"$ne": ["$thumbnail", ""]}]},
                    "then": True,
                    "else": False
                }}
            }},
            {"$project": {"photos": 0, "thumbnail": 0}},
            {"$sort": sort_field},
            {"$limit": limit}
        ]).to_list(limit)

    # Build base URL from request
    base_url = get_base_url(request)
    logger.info(f"Public garages: base_url={base_url}, total_cars={len(cars)}")

    result = []
    # Batch fetch comment counts for all car IDs
    car_ids = [str(car["_id"]) for car in cars]
    comment_counts = {}
    async for doc in db.garage_comments.aggregate([
        {"$match": {"carId": {"$in": car_ids}}},
        {"$group": {"_id": "$carId", "count": {"$sum": 1}}}
    ]):
        comment_counts[doc["_id"]] = doc["count"]

    photos_found = 0
    for car in cars:
        try:
            user = await db.users.find_one({"_id": ObjectId(car["userId"])}, {"name": 1, "nickname": 1}) if ObjectId.is_valid(car.get("userId", "")) else None
            car_data = user_car_helper(car)
            car_data["ownerName"] = user.get("name", "Unknown") if user else "Unknown"
            car_data["ownerNickname"] = user.get("nickname", "") if user else ""
            car_data["likedBy"] = car.get("likedBy", [])

            # Return HTTP URL to thumbnail instead of base64
            car_id = car_data["id"]
            pc = car.get("_photoCount", 0)
            ht = car.get("_hasThumbnail", False)
            has_photos = pc > 0 or ht
            car_data["photos"] = [f"{base_url}/api/user-cars/{car_id}/thumbnail.jpg"] if has_photos else []
            car_data["photoCount"] = pc
            car_data["mainPhotoIndex"] = 0
            car_data["commentCount"] = comment_counts.get(car_id, 0)
            if has_photos:
                photos_found += 1

            result.append(car_data)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Skipping broken car {car.get('_id')}: {e}")
            continue

    logger.info(f"Public garages: returning {len(result)} cars, {photos_found} with photos")
    return result


@router.get("/user-cars/{car_id}")
async def get_car_by_id(request: Request, car_id: str):
    """Get a specific car by ID - returns HTTP image URLs for each photo."""
    if not ObjectId.is_valid(car_id):
        raise HTTPException(status_code=400, detail="Invalid car ID")

    # Load car WITHOUT photos to keep response small
    car = await db.user_cars.find_one({"_id": ObjectId(car_id)}, {"photos": 0})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    await db.user_cars.update_one(
        {"_id": ObjectId(car_id)},
        {"$inc": {"views": 1}}
    )

    user = await db.users.find_one({"_id": ObjectId(car["userId"])}) if ObjectId.is_valid(car.get("userId", "")) else None
    
    car_data = user_car_helper(car)
    car_data["ownerName"] = user.get("name", "Unknown") if user else "Unknown"
    car_data["ownerNickname"] = user.get("nickname", "") if user else ""
    car_data["likedBy"] = car.get("likedBy", [])
    
    # Get photo count
    count_doc = await db.user_cars.aggregate([
        {"$match": {"_id": ObjectId(car_id)}},
        {"$project": {"photoCount": {"$size": {"$ifNull": ["$photos", []]}}}}
    ]).to_list(1)
    photo_count = count_doc[0]["photoCount"] if count_doc else 0
    car_data["photoCount"] = photo_count
    
    # Build base URL from request
    base_url = get_base_url(request)
    
    # Return unique HTTP URLs for each photo (not duplicated thumbnails!)
    if photo_count > 0:
        car_data["photos"] = [
            f"{base_url}/api/user-cars/{car_id}/photo/{i}/image.jpg"
            for i in range(photo_count)
        ]
        # Check photo integrity for the owner
        full_car = await db.user_cars.find_one({"_id": ObjectId(car_id)}, {"photos": 1})
        broken_indices = []
        if full_car and full_car.get("photos"):
            for i, photo in enumerate(full_car["photos"]):
                if not photo or len(str(photo)) < 100:
                    broken_indices.append(i)
                elif isinstance(photo, str) and photo.startswith("http"):
                    broken_indices.append(i)
                else:
                    # Quick decode test
                    test_data = photo
                    if "," in test_data and test_data.startswith("data:"):
                        test_data = test_data.split(",", 1)[1]
                    try:
                        base64.b64decode(test_data[:100])
                    except Exception:
                        broken_indices.append(i)
        if broken_indices:
            car_data["brokenPhotos"] = broken_indices
    else:
        car_data["photos"] = []
    car_data["mainPhotoIndex"] = car.get("mainPhotoIndex", 0)

    return car_data


@router.get("/user-cars/{car_id}/photo/{index}")
async def get_car_photo(car_id: str, index: int):
    """Get a single full-size photo by index for lazy loading in the detail view."""
    if not ObjectId.is_valid(car_id):
        raise HTTPException(status_code=400, detail="Invalid car ID")
    
    photo_doc = await db.user_cars.find_one(
        {"_id": ObjectId(car_id)},
        {"photos": {"$slice": [index, 1]}, "_id": 0}
    )
    
    if not photo_doc or not photo_doc.get("photos"):
        raise HTTPException(status_code=404, detail="Photo not found")
    
    photo = photo_doc["photos"][0] if photo_doc["photos"] else None
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Compress if still oversized (max ~800KB per photo)
    if len(photo) > MAX_PHOTO_SIZE_BYTES:
        photo = compress_photo_base64(photo)
    
    return {"photo": photo, "index": index}


@router.put("/user-cars/{car_id}")
async def update_user_car(car_id: str, car_update: UserCarUpdate):
    if not ObjectId.is_valid(car_id):
        raise HTTPException(status_code=400, detail="Invalid car ID")

    update_data = {k: v for k, v in car_update.dict().items() if v is not None}
    update_data["updatedAt"] = datetime.utcnow().isoformat()

    # Compress photos to prevent DocumentTooLarge errors
    if update_data.get("photos"):
        update_data["photos"] = compress_photos_list(update_data["photos"])

        # Validate total document size won't exceed 15MB MongoDB limit
        MAX_DOC_SIZE = 15 * 1024 * 1024  # 15MB
        total_photo_bytes = sum(len(p.encode('utf-8')) if isinstance(p, str) else 0 for p in update_data["photos"])
        # Estimate ~2KB overhead for non-photo fields
        estimated_doc_size = total_photo_bytes + 2048

        if estimated_doc_size > MAX_DOC_SIZE:
            # Progressively re-compress with lower quality until under limit
            from helpers import compress_photo_base64
            import io as _io
            import base64 as _b64
            from PIL import Image as _Img

            for quality in [50, 35, 20]:
                recompressed = []
                for photo in update_data["photos"]:
                    try:
                        raw = photo.split(',', 1)[-1] if ',' in photo and photo.startswith('data:') else photo
                        img_bytes = _b64.b64decode(raw)
                        img = _Img.open(_io.BytesIO(img_bytes))
                        if img.mode in ('RGBA', 'P'):
                            img = img.convert('RGB')
                        # Shrink dimensions further
                        w, h = img.size
                        max_dim = 800 if quality <= 35 else 1000
                        if w > max_dim or h > max_dim:
                            ratio = min(max_dim / w, max_dim / h)
                            img = img.resize((int(w * ratio), int(h * ratio)), _Img.LANCZOS)
                        buf = _io.BytesIO()
                        img.save(buf, format='JPEG', quality=quality, optimize=True)
                        compressed = _b64.b64encode(buf.getvalue()).decode('utf-8')
                        recompressed.append(f"data:image/jpeg;base64,{compressed}")
                    except Exception:
                        recompressed.append(photo)

                update_data["photos"] = recompressed
                total_photo_bytes = sum(len(p.encode('utf-8')) for p in recompressed)
                if total_photo_bytes + 2048 <= MAX_DOC_SIZE:
                    break

            # Final check — if still too large, strip excess photos
            total_photo_bytes = sum(len(p.encode('utf-8')) for p in update_data["photos"])
            if total_photo_bytes + 2048 > MAX_DOC_SIZE:
                kept = []
                running_size = 2048
                for photo in update_data["photos"]:
                    photo_size = len(photo.encode('utf-8'))
                    if running_size + photo_size <= MAX_DOC_SIZE:
                        kept.append(photo)
                        running_size += photo_size
                    else:
                        break
                update_data["photos"] = kept
                logger.warning(f"Stripped photos to {len(kept)} to stay under 15MB limit for car {car_id}")

    if update_data:
        try:
            await db.user_cars.update_one(
                {"_id": ObjectId(car_id)},
                {"$set": update_data}
            )
        except DocumentTooLarge:
            raise HTTPException(status_code=413, detail="Photos are too large. Please use fewer or smaller images.")

    updated_car = await db.user_cars.find_one({"_id": ObjectId(car_id)})
    if not updated_car:
        raise HTTPException(status_code=404, detail="Car not found")

    return user_car_helper(updated_car)


@router.post("/user-cars/{car_id}/like")
async def like_car(car_id: str, user_id: str = Query(...)):
    """Toggle like/unlike a car in someone's garage"""
    if not ObjectId.is_valid(car_id):
        raise HTTPException(status_code=400, detail="Invalid car ID")

    car = await db.user_cars.find_one({"_id": ObjectId(car_id)})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    liked_by = car.get("likedBy", [])

    if user_id in liked_by:
        # Unlike
        await db.user_cars.update_one(
            {"_id": ObjectId(car_id)},
            {
                "$pull": {"likedBy": user_id},
                "$inc": {"likes": -1}
            }
        )
    else:
        # Like
        await db.user_cars.update_one(
            {"_id": ObjectId(car_id)},
            {
                "$addToSet": {"likedBy": user_id},
                "$inc": {"likes": 1}
            }
        )

    updated_car = await db.user_cars.find_one({"_id": ObjectId(car_id)})
    car_data = user_car_helper(updated_car)
    car_data["likedBy"] = updated_car.get("likedBy", [])
    return car_data


@router.delete("/user-cars/{car_id}")
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


@router.put("/admin/user-cars/{car_id}/set-likes")
async def admin_set_likes(car_id: str, admin_id: str = Query(...), likes: int = Query(...)):
    """Admin-only: set the like count on a garage entry"""
    if not ObjectId.is_valid(admin_id):
        raise HTTPException(status_code=400, detail="Invalid admin ID")

    admin = await db.users.find_one({"_id": ObjectId(admin_id)})
    if not admin or not admin.get("isAdmin", False):
        raise HTTPException(status_code=403, detail="Unauthorized - Admin access required")

    if not ObjectId.is_valid(car_id):
        raise HTTPException(status_code=400, detail="Invalid car ID")

    car = await db.user_cars.find_one({"_id": ObjectId(car_id)})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    await db.user_cars.update_one(
        {"_id": ObjectId(car_id)},
        {"$set": {"likes": max(0, likes)}}
    )

    updated_car = await db.user_cars.find_one({"_id": ObjectId(car_id)})
    car_data = user_car_helper(updated_car)
    return car_data


# ==================== CHUNKED PHOTO UPLOAD ====================

@router.post("/user-cars/{car_id}/photos/upload")
async def upload_single_photo(car_id: str, body: SinglePhotoUpload, user_id: str = Query(...)):
    """Upload a single photo to a car. This endpoint accepts one photo at a time
    to stay within proxy body size limits. The photo is compressed server-side."""
    if not ObjectId.is_valid(car_id):
        raise HTTPException(status_code=400, detail="Invalid car ID")

    car = await db.user_cars.find_one({"_id": ObjectId(car_id)})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    if car["userId"] != user_id:
        raise HTTPException(status_code=403, detail="You can only upload to your own garage")

    current_photos = car.get("photos", [])
    if len(current_photos) >= 10:
        raise HTTPException(status_code=400, detail="Maximum 10 photos allowed")

    # Compress the photo server-side
    compressed = compress_photo_base64(body.photo)

    try:
        await db.user_cars.update_one(
            {"_id": ObjectId(car_id)},
            {"$push": {"photos": compressed}}
        )
    except DocumentTooLarge:
        raise HTTPException(status_code=413, detail="Adding this photo would exceed the storage limit. Try a smaller image.")

    updated_car = await db.user_cars.find_one({"_id": ObjectId(car_id)})
    photo_count = len(updated_car.get("photos", []))

    # Auto-generate thumbnail from the main photo (first photo or newly uploaded)
    main_idx = updated_car.get("mainPhotoIndex", 0)
    photos = updated_car.get("photos", [])
    if photos:
        source_photo = photos[min(main_idx, len(photos) - 1)]
        thumbnail = make_thumbnail_base64(source_photo)
        if thumbnail:
            await db.user_cars.update_one(
                {"_id": ObjectId(car_id)},
                {"$set": {"thumbnail": thumbnail, "photoCount": photo_count}}
            )

    return {
        "success": True,
        "photoCount": photo_count,
        "message": f"Photo {photo_count} uploaded successfully"
    }


@router.delete("/user-cars/{car_id}/photos/{photo_index}")
async def remove_photo_by_index(car_id: str, photo_index: int, user_id: str = Query(...)):
    """Remove a single photo from a car by its index."""
    if not ObjectId.is_valid(car_id):
        raise HTTPException(status_code=400, detail="Invalid car ID")

    car = await db.user_cars.find_one({"_id": ObjectId(car_id)})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    if car["userId"] != user_id:
        raise HTTPException(status_code=403, detail="You can only modify your own garage")

    photos = car.get("photos", [])
    if photo_index < 0 or photo_index >= len(photos):
        raise HTTPException(status_code=400, detail="Invalid photo index")

    # Remove photo at index
    photos.pop(photo_index)
    
    # Adjust mainPhotoIndex if needed
    main_idx = car.get("mainPhotoIndex", 0)
    if photo_index == main_idx:
        main_idx = 0
    elif photo_index < main_idx:
        main_idx = max(0, main_idx - 1)
    
    if main_idx >= len(photos):
        main_idx = max(0, len(photos) - 1)

    await db.user_cars.update_one(
        {"_id": ObjectId(car_id)},
        {"$set": {"photos": photos, "mainPhotoIndex": main_idx}}
    )

    return {"success": True, "photoCount": len(photos), "mainPhotoIndex": main_idx}


@router.post("/user-cars/create-or-update-metadata")
async def create_or_update_car_metadata(car: UserCarCreate):
    """Create or update a car's metadata WITHOUT photos.
    Photos should be uploaded separately via the chunked upload endpoint.
    Supports up to 2 cars per user. Only one can be active at a time."""
    car_dict = car.dict()
    
    # Extract carId if provided (for updating a specific car)
    car_id = car_dict.pop("carId", None)
    
    # Remove photos from the metadata save — they'll be uploaded separately
    photos_to_save = car_dict.pop("photos", None)
    car_dict["updatedAt"] = datetime.utcnow().isoformat()

    if car_id and ObjectId.is_valid(car_id):
        # Update a specific car by ID
        existing = await db.user_cars.find_one({"_id": ObjectId(car_id), "userId": car.userId})
        if not existing:
            raise HTTPException(status_code=404, detail="Car not found")
        
        if not photos_to_save:
            car_dict.pop("photos", None)
        
        await db.user_cars.update_one(
            {"_id": existing["_id"]},
            {"$set": car_dict}
        )
        updated = await db.user_cars.find_one({"_id": existing["_id"]})
        result = user_car_helper(updated)
        result["photoCount"] = len(updated.get("photos", []))
        return result
    else:
        # Check how many cars the user already has
        user_cars = await db.user_cars.find({"userId": car.userId}).to_list(10)
        
        if len(user_cars) >= 2:
            raise HTTPException(status_code=400, detail="Maximum of 2 cars allowed per user")
        
        if len(user_cars) == 1:
            # Adding a second car — make it inactive by default (first car stays active)
            car_dict["isActive"] = False
        else:
            # First car — make it active
            car_dict["isActive"] = True
        
        car_dict["likes"] = 0
        car_dict["views"] = 0
        car_dict["likedBy"] = []
        car_dict["createdAt"] = datetime.utcnow().isoformat()
        car_dict["photos"] = []  # Start empty, photos uploaded separately
        
        insert_result = await db.user_cars.insert_one(car_dict)
        created = await db.user_cars.find_one({"_id": insert_result.inserted_id})
        result = user_car_helper(created)
        result["photoCount"] = 0
        return result


# ==================== Garage Comments ====================

@router.post("/garage-comments")
async def create_garage_comment(comment: GarageCommentCreate):
    """Add a comment to a car in the public garage."""
    if not ObjectId.is_valid(comment.carId):
        raise HTTPException(status_code=400, detail="Invalid car ID")
    
    car = await db.user_cars.find_one({"_id": ObjectId(comment.carId)})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    
    comment_dict = comment.dict()
    comment_dict["createdAt"] = datetime.utcnow().isoformat()
    
    result = await db.garage_comments.insert_one(comment_dict)
    created = await db.garage_comments.find_one({"_id": result.inserted_id})
    
    # Send notification to car owner (if commenter is not the owner)
    car_owner_id = str(car.get("userId", ""))
    if car_owner_id and car_owner_id != comment.userId:
        car_label = f"{car.get('year', '')} {car.get('make', '')} {car.get('model', '')}".strip()
        notification = {
            "userId": car_owner_id,
            "type": "garage_comment",
            "title": "New Comment on Your Ride",
            "message": f"{comment.userName} commented on your {car_label}: \"{comment.text[:80]}{'...' if len(comment.text) > 80 else ''}\"",
            "carId": comment.carId,
            "isRead": False,
            "createdAt": datetime.utcnow().isoformat()
        }
        await db.notifications.insert_one(notification)
    
    return {
        "id": str(created["_id"]),
        "carId": _sid(created["carId"]),
        "userId": _sid(created["userId"]),
        "userName": created["userName"],
        "text": created["text"],
        "createdAt": _isodate(created.get("createdAt"))
    }


@router.get("/garage-comments/{car_id}")
async def get_garage_comments(car_id: str):
    """Get all comments for a specific car."""
    if not ObjectId.is_valid(car_id):
        raise HTTPException(status_code=400, detail="Invalid car ID")
    
    comments = await db.garage_comments.find(
        {"carId": car_id}
    ).sort("createdAt", -1).to_list(100)
    
    return [{
        "id": str(c["_id"]),
        "carId": _sid(c["carId"]),
        "userId": _sid(c["userId"]),
        "userName": c["userName"],
        "text": c["text"],
        "createdAt": _isodate(c.get("createdAt"))
    } for c in comments]


@router.delete("/garage-comments/{comment_id}")
async def delete_garage_comment(comment_id: str, user_id: str = Query(...)):
    """Delete a garage comment (owner of comment or admin only)."""
    if not ObjectId.is_valid(comment_id):
        raise HTTPException(status_code=400, detail="Invalid comment ID")
    
    comment = await db.garage_comments.find_one({"_id": ObjectId(comment_id)})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Check if user is comment author or admin
    user = await db.users.find_one({"_id": ObjectId(user_id)}) if ObjectId.is_valid(user_id) else None
    is_admin = user.get("isAdmin", False) if user else False
    
    if str(comment.get("userId", "")) != user_id and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")
    
    await db.garage_comments.delete_one({"_id": ObjectId(comment_id)})
    return {"message": "Comment deleted"}



@router.put("/garage-comments/{comment_id}")
async def edit_garage_comment(comment_id: str, user_id: str = Query(...), text: str = Query(...)):
    """Edit a garage comment (owner only)."""
    if not ObjectId.is_valid(comment_id):
        raise HTTPException(status_code=400, detail="Invalid comment ID")
    
    comment = await db.garage_comments.find_one({"_id": ObjectId(comment_id)})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    if str(comment.get("userId", "")) != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this comment")
    
    await db.garage_comments.update_one(
        {"_id": ObjectId(comment_id)},
        {"$set": {"text": text.strip(), "edited": True, "updatedAt": datetime.utcnow()}}
    )
    return {"message": "Comment updated"}
