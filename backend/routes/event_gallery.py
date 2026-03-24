from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from bson import ObjectId

from database import db
from models import EventPhotoUpload, PhotoTagCreate
from helpers import event_photo_helper

router = APIRouter()


@router.get("/events/{event_id}/gallery")
async def get_event_gallery(event_id: str):
    """Get all photos for an event gallery"""
    original_event_id = event_id
    if "__" in event_id:
        original_event_id = event_id.split("__")[0]

    if not ObjectId.is_valid(original_event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")

    event = await db.events.find_one({"_id": ObjectId(original_event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    photos = await db.event_photos.find({
        "eventId": {"$in": [event_id, original_event_id]}
    }).sort("createdAt", -1).to_list(500)

    return {
        "eventId": event_id,
        "eventTitle": event.get("title", ""),
        "photoCount": len(photos),
        "photos": [event_photo_helper(photo) for photo in photos]
    }


@router.post("/events/{event_id}/gallery/upload")
async def upload_event_photo(event_id: str, data: EventPhotoUpload):
    """Upload a photo to an event gallery"""
    original_event_id = event_id
    if "__" in event_id:
        original_event_id = event_id.split("__")[0]

    if not ObjectId.is_valid(original_event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")

    if not ObjectId.is_valid(data.uploaderId):
        raise HTTPException(status_code=400, detail="Invalid uploader ID")

    event = await db.events.find_one({"_id": ObjectId(original_event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    photo_data = {
        "eventId": event_id,
        "uploaderId": data.uploaderId,
        "uploaderName": data.uploaderName,
        "photo": data.photo,
        "caption": data.caption or "",
        "tags": [],
        "likes": [],
        "likeCount": 0,
        "createdAt": datetime.utcnow().isoformat()
    }

    result = await db.event_photos.insert_one(photo_data)
    photo_data["_id"] = result.inserted_id

    return event_photo_helper(photo_data)


@router.post("/events/{event_id}/gallery/{photo_id}/tag")
async def tag_car_in_photo(event_id: str, photo_id: str, tag: PhotoTagCreate):
    """Tag a user's car in an event photo"""
    if not ObjectId.is_valid(photo_id):
        raise HTTPException(status_code=400, detail="Invalid photo ID")

    if not ObjectId.is_valid(tag.userId):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    if not ObjectId.is_valid(tag.carId):
        raise HTTPException(status_code=400, detail="Invalid car ID")

    photo = await db.event_photos.find_one({"_id": ObjectId(photo_id), "eventId": event_id})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    car = await db.user_cars.find_one({"_id": ObjectId(tag.carId), "userId": tag.userId})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found or doesn't belong to user")

    existing_tags = photo.get("tags", [])
    for existing_tag in existing_tags:
        if existing_tag.get("carId") == tag.carId:
            raise HTTPException(status_code=400, detail="This car is already tagged in this photo")

    car_info = tag.carInfo or f"{car.get('year', '')} {car.get('make', '')} {car.get('model', '')}".strip()

    new_tag = {
        "userId": tag.userId,
        "carId": tag.carId,
        "carInfo": car_info,
        "taggedAt": datetime.utcnow().isoformat()
    }

    await db.event_photos.update_one(
        {"_id": ObjectId(photo_id)},
        {"$push": {"tags": new_tag}}
    )

    updated_photo = await db.event_photos.find_one({"_id": ObjectId(photo_id)})
    return event_photo_helper(updated_photo)


@router.delete("/events/{event_id}/gallery/{photo_id}/tag/{car_id}")
async def remove_car_tag(event_id: str, photo_id: str, car_id: str, user_id: str = Query(...)):
    """Remove a car tag from a photo"""
    if not ObjectId.is_valid(photo_id):
        raise HTTPException(status_code=400, detail="Invalid photo ID")

    photo = await db.event_photos.find_one({"_id": ObjectId(photo_id), "eventId": event_id})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    result = await db.event_photos.update_one(
        {"_id": ObjectId(photo_id)},
        {"$pull": {"tags": {"carId": car_id, "userId": user_id}}}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Tag not found")

    return {"message": "Tag removed successfully"}


@router.post("/events/{event_id}/gallery/{photo_id}/like")
async def like_event_photo(event_id: str, photo_id: str, user_id: str = Query(...)):
    """Like or unlike an event photo"""
    if not ObjectId.is_valid(photo_id):
        raise HTTPException(status_code=400, detail="Invalid photo ID")

    photo = await db.event_photos.find_one({"_id": ObjectId(photo_id), "eventId": event_id})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    likes = photo.get("likes", [])

    if user_id in likes:
        await db.event_photos.update_one(
            {"_id": ObjectId(photo_id)},
            {"$pull": {"likes": user_id}, "$inc": {"likeCount": -1}}
        )
        return {"liked": False, "likeCount": photo.get("likeCount", 1) - 1}
    else:
        await db.event_photos.update_one(
            {"_id": ObjectId(photo_id)},
            {"$push": {"likes": user_id}, "$inc": {"likeCount": 1}}
        )
        return {"liked": True, "likeCount": photo.get("likeCount", 0) + 1}


@router.delete("/events/{event_id}/gallery/{photo_id}")
async def delete_event_photo(event_id: str, photo_id: str, user_id: str = Query(...)):
    """Delete a photo from event gallery"""
    if not ObjectId.is_valid(photo_id):
        raise HTTPException(status_code=400, detail="Invalid photo ID")

    photo = await db.event_photos.find_one({"_id": ObjectId(photo_id), "eventId": event_id})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    is_admin = user.get("isAdmin", False) if user else False

    if photo["uploaderId"] != user_id and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to delete this photo")

    await db.event_photos.delete_one({"_id": ObjectId(photo_id)})
    return {"message": "Photo deleted successfully"}


@router.get("/users/{user_id}/tagged-photos")
async def get_user_tagged_photos(user_id: str):
    """Get all photos where the user's cars are tagged"""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    photos = await db.event_photos.find(
        {"tags.userId": user_id}
    ).sort("createdAt", -1).to_list(500)

    result = []
    for photo in photos:
        event = await db.events.find_one({"_id": ObjectId(photo["eventId"])}) if ObjectId.is_valid(photo["eventId"]) else None
        user_tags = [tag for tag in photo.get("tags", []) if tag.get("userId") == user_id]

        result.append({
            **event_photo_helper(photo),
            "eventTitle": event.get("title", "Unknown Event") if event else "Unknown Event",
            "eventDate": event.get("date", "") if event else "",
            "userTags": user_tags
        })

    return result


@router.get("/cars/{car_id}/tagged-photos")
async def get_car_tagged_photos(car_id: str):
    """Get all photos where a specific car is tagged"""
    if not ObjectId.is_valid(car_id):
        raise HTTPException(status_code=400, detail="Invalid car ID")

    photos = await db.event_photos.find(
        {"tags.carId": car_id}
    ).sort("createdAt", -1).to_list(500)

    result = []
    for photo in photos:
        event = await db.events.find_one({"_id": ObjectId(photo["eventId"])}) if ObjectId.is_valid(photo["eventId"]) else None

        result.append({
            **event_photo_helper(photo),
            "eventTitle": event.get("title", "Unknown Event") if event else "Unknown Event",
            "eventDate": event.get("date", "") if event else "",
        })

    return result
