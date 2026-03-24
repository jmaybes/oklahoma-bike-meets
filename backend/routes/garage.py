from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import datetime
from bson import ObjectId

from database import db
from models import UserCarCreate, UserCarUpdate
from helpers import user_car_helper

router = APIRouter()


@router.post("/user-cars")
async def create_user_car(car: UserCarCreate):
    car_dict = car.dict()
    car_dict["likes"] = 0
    car_dict["views"] = 0
    car_dict["createdAt"] = datetime.utcnow().isoformat()

    existing = await db.user_cars.find_one({"userId": car.userId})
    if existing:
        await db.user_cars.update_one(
            {"_id": existing["_id"]},
            {"$set": {**car_dict, "updatedAt": datetime.utcnow().isoformat()}}
        )
        updated_car = await db.user_cars.find_one({"_id": existing["_id"]})
        return user_car_helper(updated_car)

    result = await db.user_cars.insert_one(car_dict)
    created_car = await db.user_cars.find_one({"_id": result.inserted_id})
    return user_car_helper(created_car)


@router.get("/user-cars/user/{user_id}")
async def get_user_car(user_id: str):
    car = await db.user_cars.find_one({"userId": user_id})
    if not car:
        return None
    return user_car_helper(car)


@router.get("/user-cars/public")
async def get_public_garages(
    make: Optional[str] = None,
    limit: int = Query(default=50, le=100)
):
    """Get all public garages to browse"""
    query = {"isPublic": True}
    if make:
        query["make"] = {"$regex": make, "$options": "i"}

    cars = await db.user_cars.find(query).sort("createdAt", -1).limit(limit).to_list(limit)

    result = []
    for car in cars:
        user = await db.users.find_one({"_id": ObjectId(car["userId"])}) if ObjectId.is_valid(car["userId"]) else None
        car_data = user_car_helper(car)
        car_data["ownerName"] = user.get("name", "Unknown") if user else "Unknown"
        car_data["ownerNickname"] = user.get("nickname", "") if user else ""
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

    return car_data


@router.put("/user-cars/{car_id}")
async def update_user_car(car_id: str, car_update: UserCarUpdate):
    if not ObjectId.is_valid(car_id):
        raise HTTPException(status_code=400, detail="Invalid car ID")

    update_data = {k: v for k, v in car_update.dict().items() if v is not None}
    update_data["updatedAt"] = datetime.utcnow().isoformat()

    if update_data:
        await db.user_cars.update_one(
            {"_id": ObjectId(car_id)},
            {"$set": update_data}
        )

    updated_car = await db.user_cars.find_one({"_id": ObjectId(car_id)})
    if not updated_car:
        raise HTTPException(status_code=404, detail="Car not found")

    return user_car_helper(updated_car)


@router.post("/user-cars/{car_id}/like")
async def like_car(car_id: str, user_id: str = Query(...)):
    """Like a car in someone's garage"""
    if not ObjectId.is_valid(car_id):
        raise HTTPException(status_code=400, detail="Invalid car ID")

    await db.user_cars.update_one(
        {"_id": ObjectId(car_id)},
        {"$inc": {"likes": 1}}
    )

    updated_car = await db.user_cars.find_one({"_id": ObjectId(car_id)})
    return user_car_helper(updated_car)


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
