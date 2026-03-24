from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from bson import ObjectId

from database import db
from models import PerformanceRunCreate

router = APIRouter()


@router.post("/performance-runs")
async def create_performance_run(run: PerformanceRunCreate):
    run_dict = run.dict()
    run_dict["createdAt"] = datetime.utcnow().isoformat()

    result = await db.performance_runs.insert_one(run_dict)
    created_run = await db.performance_runs.find_one({"_id": result.inserted_id})

    return {
        "id": str(created_run["_id"]),
        "userId": created_run["userId"],
        "carInfo": created_run["carInfo"],
        "zeroToSixty": created_run.get("zeroToSixty"),
        "zeroToHundred": created_run.get("zeroToHundred"),
        "quarterMile": created_run.get("quarterMile"),
        "location": created_run.get("location", ""),
        "createdAt": created_run["createdAt"]
    }


@router.get("/leaderboard/0-60")
async def get_zero_to_sixty_leaderboard(limit: int = 100):
    runs = await db.performance_runs.find(
        {"zeroToSixty": {"$exists": True, "$ne": None}}
    ).sort("zeroToSixty", 1).limit(limit).to_list(limit)

    leaderboard = []
    for run in runs:
        user = await db.users.find_one({"_id": ObjectId(run["userId"])})
        leaderboard.append({
            "id": str(run["_id"]),
            "userId": run["userId"],
            "userName": user["name"] if user else "Unknown",
            "nickname": user.get("nickname", "") if user else "",
            "carInfo": run["carInfo"],
            "time": run["zeroToSixty"],
            "location": run.get("location", ""),
            "createdAt": run["createdAt"]
        })

    return leaderboard


@router.get("/leaderboard/0-100")
async def get_zero_to_hundred_leaderboard(limit: int = 100):
    runs = await db.performance_runs.find(
        {"zeroToHundred": {"$exists": True, "$ne": None}}
    ).sort("zeroToHundred", 1).limit(limit).to_list(limit)

    leaderboard = []
    for run in runs:
        user = await db.users.find_one({"_id": ObjectId(run["userId"])})
        leaderboard.append({
            "id": str(run["_id"]),
            "userId": run["userId"],
            "userName": user["name"] if user else "Unknown",
            "nickname": user.get("nickname", "") if user else "",
            "carInfo": run["carInfo"],
            "time": run["zeroToHundred"],
            "location": run.get("location", ""),
            "createdAt": run["createdAt"]
        })

    return leaderboard


@router.get("/leaderboard/quarter-mile")
async def get_quarter_mile_leaderboard(limit: int = 100):
    runs = await db.performance_runs.find(
        {"quarterMile": {"$exists": True, "$ne": None}}
    ).sort("quarterMile", 1).limit(limit).to_list(limit)

    leaderboard = []
    for run in runs:
        user = await db.users.find_one({"_id": ObjectId(run["userId"])})
        leaderboard.append({
            "id": str(run["_id"]),
            "userId": run["userId"],
            "userName": user["name"] if user else "Unknown",
            "nickname": user.get("nickname", "") if user else "",
            "carInfo": run["carInfo"],
            "time": run["quarterMile"],
            "location": run.get("location", ""),
            "createdAt": run["createdAt"]
        })

    return leaderboard


@router.get("/performance-runs/user/{user_id}")
async def get_user_performance_runs(user_id: str):
    runs = await db.performance_runs.find({"userId": user_id}).sort("createdAt", -1).to_list(1000)

    return [{
        "id": str(run["_id"]),
        "userId": run["userId"],
        "carInfo": run["carInfo"],
        "zeroToSixty": run.get("zeroToSixty"),
        "zeroToHundred": run.get("zeroToHundred"),
        "quarterMile": run.get("quarterMile"),
        "location": run.get("location", ""),
        "createdAt": run["createdAt"]
    } for run in runs]
