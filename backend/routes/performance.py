from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from bson import ObjectId

from database import db
from models import PerformanceRunCreate, PerformanceRunUpdate
from helpers import _sid, _isodate

router = APIRouter()


def serialize_run(run, user=None):
    """Helper to serialize a performance run document."""
    return {
        "id": str(run["_id"]),
        "userId": _sid(run["userId"]),
        "userName": user["name"] if user else run.get("userName", "Unknown"),
        "nickname": (user.get("nickname", "") if user else run.get("nickname", "")),
        "carInfo": run.get("carInfo", ""),
        "zeroToSixty": run.get("zeroToSixty"),
        "zeroToHundred": run.get("zeroToHundred"),
        "quarterMile": run.get("quarterMile"),
        "quarterMileSpeed": run.get("quarterMileSpeed"),
        "topSpeed": run.get("topSpeed"),
        "location": run.get("location", ""),
        "isManualEntry": run.get("isManualEntry", False),
        "createdAt": _isodate(run.get("createdAt")) if run.get("createdAt") else "",
    }


@router.post("/performance-runs")
async def create_performance_run(run: PerformanceRunCreate):
    run_dict = run.dict()
    run_dict["createdAt"] = datetime.utcnow().isoformat()

    result = await db.performance_runs.insert_one(run_dict)
    created_run = await db.performance_runs.find_one({"_id": result.inserted_id})

    return serialize_run(created_run)


@router.get("/performance-runs/user/{user_id}/best")
async def get_user_personal_bests(user_id: str):
    """Get a user's personal best times for each category."""
    best = {}

    # Best 0-60
    best_060 = await db.performance_runs.find(
        {"userId": user_id, "zeroToSixty": {"$exists": True, "$ne": None}}
    ).sort("zeroToSixty", 1).limit(1).to_list(1)
    best["zeroToSixty"] = best_060[0]["zeroToSixty"] if best_060 else None

    # Best 0-100
    best_0100 = await db.performance_runs.find(
        {"userId": user_id, "zeroToHundred": {"$exists": True, "$ne": None}}
    ).sort("zeroToHundred", 1).limit(1).to_list(1)
    best["zeroToHundred"] = best_0100[0]["zeroToHundred"] if best_0100 else None

    # Best quarter mile
    best_qm = await db.performance_runs.find(
        {"userId": user_id, "quarterMile": {"$exists": True, "$ne": None}}
    ).sort("quarterMile", 1).limit(1).to_list(1)
    best["quarterMile"] = best_qm[0]["quarterMile"] if best_qm else None

    # Total runs count
    total = await db.performance_runs.count_documents({"userId": user_id})
    best["totalRuns"] = total

    return best


@router.get("/leaderboard/0-60")
async def get_zero_to_sixty_leaderboard(limit: int = 100):
    runs = await db.performance_runs.find(
        {"zeroToSixty": {"$exists": True, "$ne": None}}
    ).sort("zeroToSixty", 1).limit(limit).to_list(limit)

    leaderboard = []
    for run in runs:
        user = None
        if ObjectId.is_valid(run.get("userId", "")):
            user = await db.users.find_one({"_id": ObjectId(run["userId"])})
        entry = serialize_run(run, user)
        entry["time"] = run["zeroToSixty"]
        leaderboard.append(entry)

    return leaderboard


@router.get("/leaderboard/0-100")
async def get_zero_to_hundred_leaderboard(limit: int = 100):
    runs = await db.performance_runs.find(
        {"zeroToHundred": {"$exists": True, "$ne": None}}
    ).sort("zeroToHundred", 1).limit(limit).to_list(limit)

    leaderboard = []
    for run in runs:
        user = None
        if ObjectId.is_valid(run.get("userId", "")):
            user = await db.users.find_one({"_id": ObjectId(run["userId"])})
        entry = serialize_run(run, user)
        entry["time"] = run["zeroToHundred"]
        leaderboard.append(entry)

    return leaderboard


@router.get("/leaderboard/quarter-mile")
async def get_quarter_mile_leaderboard(limit: int = 100):
    runs = await db.performance_runs.find(
        {"quarterMile": {"$exists": True, "$ne": None}}
    ).sort("quarterMile", 1).limit(limit).to_list(limit)

    leaderboard = []
    for run in runs:
        user = None
        if ObjectId.is_valid(run.get("userId", "")):
            user = await db.users.find_one({"_id": ObjectId(run["userId"])})
        entry = serialize_run(run, user)
        entry["time"] = run["quarterMile"]
        leaderboard.append(entry)

    return leaderboard


@router.get("/performance-runs/user/{user_id}")
async def get_user_performance_runs(user_id: str):
    runs = await db.performance_runs.find({"userId": user_id}).sort("createdAt", -1).to_list(1000)
    result = []
    for run in runs:
        try:
            result.append(serialize_run(run))
        except Exception:
            continue
    return result


@router.delete("/admin/performance-runs/{run_id}")
async def admin_delete_performance_run(run_id: str, admin_id: str = Query(...)):
    """Admin-only: delete a leaderboard entry."""
    if not ObjectId.is_valid(admin_id):
        raise HTTPException(status_code=400, detail="Invalid admin ID")

    admin = await db.users.find_one({"_id": ObjectId(admin_id)})
    if not admin or not admin.get("isAdmin", False):
        raise HTTPException(status_code=403, detail="Unauthorized - Admin access required")

    if not ObjectId.is_valid(run_id):
        raise HTTPException(status_code=400, detail="Invalid run ID")

    result = await db.performance_runs.delete_one({"_id": ObjectId(run_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Performance run not found")

    return {"success": True, "message": "Leaderboard entry deleted"}


@router.put("/admin/performance-runs/{run_id}")
async def admin_edit_performance_run(run_id: str, update: PerformanceRunUpdate, admin_id: str = Query(...)):
    """Admin-only: edit any field on a leaderboard entry."""
    if not ObjectId.is_valid(admin_id):
        raise HTTPException(status_code=400, detail="Invalid admin ID")

    admin = await db.users.find_one({"_id": ObjectId(admin_id)})
    if not admin or not admin.get("isAdmin", False):
        raise HTTPException(status_code=403, detail="Unauthorized - Admin access required")

    if not ObjectId.is_valid(run_id):
        raise HTTPException(status_code=400, detail="Invalid run ID")

    existing = await db.performance_runs.find_one({"_id": ObjectId(run_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Performance run not found")

    update_data = {k: v for k, v in update.dict().items() if v is not None}
    update_data["updatedAt"] = datetime.utcnow().isoformat()

    if update_data:
        await db.performance_runs.update_one(
            {"_id": ObjectId(run_id)},
            {"$set": update_data}
        )

    updated_run = await db.performance_runs.find_one({"_id": ObjectId(run_id)})
    user = None
    if ObjectId.is_valid(updated_run.get("userId", "")):
        user = await db.users.find_one({"_id": ObjectId(updated_run["userId"])})

    result = serialize_run(updated_run, user)
    result["updatedAt"] = updated_run.get("updatedAt")
    return result
