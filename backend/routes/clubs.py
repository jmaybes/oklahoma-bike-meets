from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from datetime import datetime
from bson import ObjectId

from database import db
from models import ClubCreate, ClubUpdate
from helpers import _isodate

router = APIRouter()


@router.post("/clubs")
async def create_club(club: ClubCreate):
    club_dict = club.dict()
    club_dict["createdAt"] = datetime.utcnow().isoformat()

    # Auto-approve all club submissions
    club_dict["isApproved"] = True

    result = await db.clubs.insert_one(club_dict)
    created_club = await db.clubs.find_one({"_id": result.inserted_id})

    return {
        "id": str(created_club["_id"]),
        "name": created_club["name"],
        "description": created_club["description"],
        "location": created_club["location"],
        "city": created_club["city"],
        "carTypes": created_club.get("carTypes", []),
        "contactInfo": created_club.get("contactInfo", ""),
        "website": created_club.get("website", ""),
        "facebookGroup": created_club.get("facebookGroup", ""),
        "meetingSchedule": created_club.get("meetingSchedule", ""),
        "memberCount": created_club.get("memberCount", ""),
        "isApproved": created_club.get("isApproved", False),
        "createdAt": created_club["createdAt"]
    }


@router.get("/clubs")
async def get_clubs(city: Optional[str] = Query(None), carType: Optional[str] = Query(None)):
    query = {"isApproved": True}

    if city:
        query["city"] = {"$regex": city, "$options": "i"}

    if carType:
        query["carTypes"] = {"$regex": carType, "$options": "i"}

    clubs = await db.clubs.find(query).sort("name", 1).to_list(1000)
    result = []
    for club in clubs:
        try:
            result.append({
                "id": str(club["_id"]),
                "name": club["name"],
                "description": club.get("description", ""),
                "location": club.get("location", ""),
                "focus": club.get("focus", ""),
                "meetingSchedule": club.get("meetingSchedule", ""),
                "contactEmail": club.get("contactEmail", ""),
                "website": club.get("website", ""),
                "memberCount": club.get("memberCount", 0),
                "isApproved": club.get("isApproved", True),
                "createdAt": _isodate(club.get("createdAt"))
            })
        except Exception:
            continue
    return result


@router.get("/clubs/{club_id}")
async def get_club(club_id: str):
    if not ObjectId.is_valid(club_id):
        raise HTTPException(status_code=400, detail="Invalid club ID")

    club = await db.clubs.find_one({"_id": ObjectId(club_id)})
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")

    return {
        "id": str(club["_id"]),
        "name": club["name"],
        "description": club["description"],
        "location": club["location"],
        "city": club["city"],
        "carTypes": club.get("carTypes", []),
        "contactInfo": club.get("contactInfo", ""),
        "website": club.get("website", ""),
        "facebookGroup": club.get("facebookGroup", ""),
        "meetingSchedule": club.get("meetingSchedule", ""),
        "memberCount": club.get("memberCount", ""),
        "photos": club.get("photos", []),
        "createdAt": _isodate(club.get("createdAt"))
    }


@router.put("/clubs/{club_id}")
async def update_club(club_id: str, club_update: ClubUpdate):
    if not ObjectId.is_valid(club_id):
        raise HTTPException(status_code=400, detail="Invalid club ID")

    update_data = {k: v for k, v in club_update.dict().items() if v is not None}

    if update_data:
        await db.clubs.update_one(
            {"_id": ObjectId(club_id)},
            {"$set": update_data}
        )

    updated_club = await db.clubs.find_one({"_id": ObjectId(club_id)})
    if not updated_club:
        raise HTTPException(status_code=404, detail="Club not found")

    return {
        "id": str(updated_club["_id"]),
        "name": updated_club.get("name", ""),
        "description": updated_club.get("description", ""),
        "location": updated_club.get("location", ""),
        "city": updated_club.get("city", ""),
        "carTypes": updated_club.get("carTypes", []),
        "contactInfo": updated_club.get("contactInfo", ""),
        "website": updated_club.get("website", ""),
        "facebookGroup": updated_club.get("facebookGroup", ""),
        "meetingSchedule": updated_club.get("meetingSchedule", ""),
        "memberCount": updated_club.get("memberCount", ""),
        "photos": updated_club.get("photos", []),
        "createdAt": updated_club.get("createdAt")
    }


@router.delete("/clubs/{club_id}")
async def delete_club(club_id: str):
    if not ObjectId.is_valid(club_id):
        raise HTTPException(status_code=400, detail="Invalid club ID")

    result = await db.clubs.delete_one({"_id": ObjectId(club_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Club not found")

    return {"message": "Club deleted successfully"}
