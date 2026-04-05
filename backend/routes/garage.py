from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from pydantic import BaseModel
from datetime import datetime
from bson import ObjectId
from pymongo.errors import DocumentTooLarge

from database import db
from models import UserCarCreate, UserCarUpdate
from helpers import user_car_helper, compress_photos_list, compress_photo_base64, make_thumbnail_base64, MAX_PHOTO_SIZE_BYTES

import logging
logger = logging.getLogger(__name__)

router = APIRouter()


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
async def get_user_car(user_id: str, include_photos: bool = Query(default=False)):
    """Get a user's car. Returns NO photos by default to prevent container OOM.
    Pass ?include_photos=true to get all photos (for editing)."""
    
    if include_photos:
        # Return thumbnails for the profile view - full photos load via /photo/{index} endpoint
        car = await db.user_cars.find_one({"userId": user_id})
        if not car:
            return None
        # Use pre-computed thumbnail, exclude heavy photos array
        result = user_car_helper(car)
        result["photoCount"] = len(car.get("photos", []))
        thumbnail = car.get("thumbnail", "")
        result["photos"] = [thumbnail] if thumbnail else ([""] * len(car.get("photos", [])) if car.get("photos") else [])
        return result
    
    # Lightweight mode: exclude full photos, use pre-computed thumbnail
    car = await db.user_cars.find_one({"userId": user_id}, {"photos": 0})
    if not car:
        return None
    
    car_data = user_car_helper(car)
    
    # Use pre-computed thumbnail (no image processing!)
    thumbnail = car.get("thumbnail", "")
    
    # Get photo count without loading photos
    count_doc = await db.user_cars.aggregate([
        {"$match": {"userId": user_id}},
        {"$project": {"photoCount": {"$size": {"$ifNull": ["$photos", []]}}}}
    ]).to_list(1)
    photo_count = count_doc[0]["photoCount"] if count_doc else 0
    
    car_data["photos"] = [thumbnail] if thumbnail else []
    car_data["photoCount"] = photo_count
    car_data["mainPhotoIndex"] = 0
    
    return car_data


@router.get("/user-cars/public")
async def get_public_garages(
    make: Optional[str] = None,
    limit: int = Query(default=50, le=100),
    sort: str = Query(default="likes", description="Sort by: likes, views, newest")
):
    """Get all public garages with pre-computed thumbnails. No image processing at request time."""
    query = {"$or": [{"isPublic": True}, {"isPublic": "true"}]}
    if make:
        query["make"] = {"$regex": make, "$options": "i"}

    # Sort options
    if sort == "views":
        sort_field = [("views", -1), ("likes", -1)]
    elif sort == "newest":
        sort_field = [("createdAt", -1)]
    else:  # default: likes
        sort_field = [("likes", -1), ("views", -1)]

    # Exclude full photos array - only fetch thumbnail + metadata
    cars = await db.user_cars.find(query, {"photos": 0}).sort(sort_field).limit(limit).to_list(limit)

    result = []
    for car in cars:
        user = await db.users.find_one({"_id": ObjectId(car["userId"])}, {"name": 1, "nickname": 1}) if ObjectId.is_valid(car.get("userId", "")) else None
        car_data = user_car_helper(car)
        car_data["ownerName"] = user.get("name", "Unknown") if user else "Unknown"
        car_data["ownerNickname"] = user.get("nickname", "") if user else ""
        car_data["likedBy"] = car.get("likedBy", [])

        # Use pre-computed thumbnail (no image processing!)
        thumbnail = car.get("thumbnail", "")
        car_data["photos"] = [thumbnail] if thumbnail else []
        car_data["photoCount"] = car.get("photoCount", 0)
        car_data["mainPhotoIndex"] = 0

        result.append(car_data)

    return result


@router.get("/user-cars/{car_id}")
async def get_car_by_id(car_id: str):
    """Get a specific car by ID - returns thumbnails to stay under proxy limits.
    Full-size photos are loaded individually via /user-cars/{car_id}/photo/{index}."""
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
    
    # Use pre-computed thumbnail for all photo slots (no PIL processing!)
    thumbnail = car.get("thumbnail", "")
    if photo_count > 0:
        car_data["photos"] = [thumbnail if thumbnail else ""] * photo_count
    else:
        car_data["photos"] = []
    car_data["mainPhotoIndex"] = 0

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
    This avoids large payloads that get rejected by the proxy."""
    car_dict = car.dict()
    
    # Remove photos from the metadata save — they'll be uploaded separately
    photos_to_save = car_dict.pop("photos", None)
    car_dict["updatedAt"] = datetime.utcnow().isoformat()

    existing = await db.user_cars.find_one({"userId": car.userId})
    if existing:
        # Preserve existing photos if none provided
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
        car_dict["likes"] = 0
        car_dict["views"] = 0
        car_dict["createdAt"] = datetime.utcnow().isoformat()
        car_dict["photos"] = []  # Start empty, photos uploaded separately
        
        insert_result = await db.user_cars.insert_one(car_dict)
        created = await db.user_cars.find_one({"_id": insert_result.inserted_id})
        result = user_car_helper(created)
        result["photoCount"] = 0
        return result
