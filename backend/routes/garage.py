from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import datetime
from bson import ObjectId
from pymongo.errors import DocumentTooLarge

from database import db
from models import UserCarCreate, UserCarUpdate
from helpers import user_car_helper, compress_photos_list

import logging
logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/user-cars")
async def create_user_car(car: UserCarCreate):
    car_dict = car.dict()
    car_dict["likes"] = 0
    car_dict["views"] = 0
    car_dict["createdAt"] = datetime.utcnow().isoformat()

    # Compress photos to prevent DocumentTooLarge errors
    if car_dict.get("photos"):
        car_dict["photos"] = compress_photos_list(car_dict["photos"])

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
    """Get a user's car. By default returns only the main photo to save bandwidth.
    Pass ?include_photos=true to get all photos (for editing)."""
    
    if include_photos:
        # Full data for editing - loads all photos
        car = await db.user_cars.find_one({"userId": user_id})
        if not car:
            return None
        return user_car_helper(car)
    
    # Optimized: exclude photos from MongoDB query to save memory
    car = await db.user_cars.find_one({"userId": user_id}, {"photos": 0})
    if not car:
        return None
    
    car_data = user_car_helper(car)
    main_idx = car.get("mainPhotoIndex", 0)
    
    # Fetch ONLY the main photo using $slice (never loads all photos into memory)
    photo_doc = await db.user_cars.find_one(
        {"userId": user_id},
        {"photos": {"$slice": [main_idx, 1]}, "_id": 0}
    )
    main_photo = photo_doc.get("photos", [None])[0] if photo_doc and photo_doc.get("photos") else None
    
    # Get total photo count without loading photos
    count_doc = await db.user_cars.aggregate([
        {"$match": {"userId": user_id}},
        {"$project": {"photoCount": {"$size": {"$ifNull": ["$photos", []]}}}}
    ]).to_list(1)
    photo_count = count_doc[0]["photoCount"] if count_doc else 0
    
    car_data["photos"] = [main_photo] if main_photo else []
    car_data["photoCount"] = photo_count
    car_data["mainPhotoIndex"] = 0
    
    return car_data


@router.get("/user-cars/public")
async def get_public_garages(
    make: Optional[str] = None,
    limit: int = Query(default=50, le=100),
    sort: str = Query(default="likes", description="Sort by: likes, views, newest")
):
    """Get all public garages to browse, sorted by most liked by default.
    Uses MongoDB projection to avoid loading all photos into memory."""
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

    # Exclude photos from the main query to save memory
    cars = await db.user_cars.find(query, {"photos": 0}).sort(sort_field).limit(limit).to_list(limit)

    result = []
    for car in cars:
        user = await db.users.find_one({"_id": ObjectId(car["userId"])}, {"name": 1, "nickname": 1}) if ObjectId.is_valid(car.get("userId", "")) else None
        car_data = user_car_helper(car)
        car_data["ownerName"] = user.get("name", "Unknown") if user else "Unknown"
        car_data["ownerNickname"] = user.get("nickname", "") if user else ""
        car_data["likedBy"] = car.get("likedBy", [])

        # Fetch only the main photo using $slice
        main_idx = car.get("mainPhotoIndex", 0)
        photo_doc = await db.user_cars.find_one(
            {"_id": car["_id"]},
            {"photos": {"$slice": [main_idx, 1]}, "_id": 0}
        )
        main_photo = photo_doc.get("photos", [None])[0] if photo_doc and photo_doc.get("photos") else None

        # Get photo count without loading photos
        count_doc = await db.user_cars.aggregate([
            {"$match": {"_id": car["_id"]}},
            {"$project": {"photoCount": {"$size": {"$ifNull": ["$photos", []]}}}}
        ]).to_list(1)
        photo_count = count_doc[0]["photoCount"] if count_doc else 0

        car_data["photos"] = [main_photo] if main_photo else []
        car_data["photoCount"] = photo_count
        car_data["mainPhotoIndex"] = 0

        result.append(car_data)

    return result


@router.get("/user-cars/{car_id}")
async def get_car_by_id(car_id: str):
    """Get a specific car by ID"""
    if not ObjectId.is_valid(car_id):
        raise HTTPException(status_code=400, detail="Invalid car ID")

    car = await db.user_cars.find_one({"_id": ObjectId(car_id)})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    await db.user_cars.update_one(
        {"_id": ObjectId(car_id)},
        {"$inc": {"views": 1}}
    )

    user = await db.users.find_one({"_id": ObjectId(car["userId"])}) if ObjectId.is_valid(car["userId"]) else None
    car_data = user_car_helper(car)
    car_data["ownerName"] = user.get("name", "Unknown") if user else "Unknown"
    car_data["ownerNickname"] = user.get("nickname", "") if user else ""
    car_data["likedBy"] = car.get("likedBy", [])

    return car_data


@router.put("/user-cars/{car_id}")
async def update_user_car(car_id: str, car_update: UserCarUpdate):
    if not ObjectId.is_valid(car_id):
        raise HTTPException(status_code=400, detail="Invalid car ID")

    update_data = {k: v for k, v in car_update.dict().items() if v is not None}
    update_data["updatedAt"] = datetime.utcnow().isoformat()

    # Compress photos to prevent DocumentTooLarge errors
    if update_data.get("photos"):
        update_data["photos"] = compress_photos_list(update_data["photos"])

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
