from fastapi import APIRouter, HTTPException, Query
from typing import List
from datetime import datetime
from bson import ObjectId

from database import db
from models import RouteCreate, RouteUpdate
from helpers import route_helper, send_push_notification

router = APIRouter()


@router.post("/routes")
async def create_route(route: RouteCreate):
    """Create a new driving route"""
    route_dict = route.dict()
    route_dict["likes"] = 0
    route_dict["savedBy"] = []
    route_dict["createdAt"] = datetime.utcnow().isoformat()

    result = await db.routes.insert_one(route_dict)
    created_route = await db.routes.find_one({"_id": result.inserted_id})
    return route_helper(created_route)


@router.get("/routes")
async def get_public_routes(
    difficulty: str = None,
    limit: int = Query(default=50, le=100)
):
    """Get all public routes"""
    query = {"isPublic": True}
    if difficulty:
        query["difficulty"] = difficulty

    routes = await db.routes.find(query).sort("createdAt", -1).limit(limit).to_list(limit)
    return [route_helper(r) for r in routes]


@router.get("/routes/user/{user_id}")
async def get_user_routes(user_id: str):
    """Get all routes created by a user"""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    routes = await db.routes.find({"userId": user_id}).sort("createdAt", -1).to_list(100)
    return [route_helper(r) for r in routes]


@router.get("/routes/saved/{user_id}")
async def get_saved_routes(user_id: str):
    """Get routes saved by a user"""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    routes = await db.routes.find({"savedBy": user_id}).sort("createdAt", -1).to_list(100)
    return [route_helper(r) for r in routes]


@router.get("/routes/{route_id}")
async def get_route(route_id: str):
    """Get a specific route"""
    if not ObjectId.is_valid(route_id):
        raise HTTPException(status_code=400, detail="Invalid route ID")

    route = await db.routes.find_one({"_id": ObjectId(route_id)})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    return route_helper(route)


@router.put("/routes/{route_id}")
async def update_route(route_id: str, route_update: RouteUpdate):
    """Update a route"""
    if not ObjectId.is_valid(route_id):
        raise HTTPException(status_code=400, detail="Invalid route ID")

    update_data = {k: v for k, v in route_update.dict().items() if v is not None}
    update_data["updatedAt"] = datetime.utcnow().isoformat()

    await db.routes.update_one(
        {"_id": ObjectId(route_id)},
        {"$set": update_data}
    )

    updated_route = await db.routes.find_one({"_id": ObjectId(route_id)})
    return route_helper(updated_route)


@router.delete("/routes/{route_id}")
async def delete_route(route_id: str, user_id: str = Query(...)):
    """Delete a route (only by owner)"""
    if not ObjectId.is_valid(route_id):
        raise HTTPException(status_code=400, detail="Invalid route ID")

    route = await db.routes.find_one({"_id": ObjectId(route_id)})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    if route["userId"] != user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own routes")

    await db.routes.delete_one({"_id": ObjectId(route_id)})
    return {"message": "Route deleted successfully"}


@router.post("/routes/{route_id}/like")
async def like_route(route_id: str, user_id: str = Query(...)):
    """Like a route"""
    if not ObjectId.is_valid(route_id):
        raise HTTPException(status_code=400, detail="Invalid route ID")

    await db.routes.update_one(
        {"_id": ObjectId(route_id)},
        {"$inc": {"likes": 1}}
    )

    updated_route = await db.routes.find_one({"_id": ObjectId(route_id)})
    return route_helper(updated_route)


@router.post("/routes/{route_id}/save")
async def save_route(route_id: str, user_id: str = Query(...)):
    """Save a route to user's collection"""
    if not ObjectId.is_valid(route_id):
        raise HTTPException(status_code=400, detail="Invalid route ID")

    route = await db.routes.find_one({"_id": ObjectId(route_id)})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    if user_id in route.get("savedBy", []):
        await db.routes.update_one(
            {"_id": ObjectId(route_id)},
            {"$pull": {"savedBy": user_id}}
        )
        message = "Route removed from saved"
    else:
        await db.routes.update_one(
            {"_id": ObjectId(route_id)},
            {"$addToSet": {"savedBy": user_id}}
        )
        message = "Route saved successfully"

    updated_route = await db.routes.find_one({"_id": ObjectId(route_id)})
    return {"message": message, "route": route_helper(updated_route)}


@router.post("/routes/{route_id}/share")
async def share_route(route_id: str, recipient_ids: List[str] = Query(...), sender_name: str = Query(...)):
    """Share a route with other users"""
    if not ObjectId.is_valid(route_id):
        raise HTTPException(status_code=400, detail="Invalid route ID")

    route = await db.routes.find_one({"_id": ObjectId(route_id)})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    notifications = []
    for recipient_id in recipient_ids:
        if ObjectId.is_valid(recipient_id):
            user = await db.users.find_one({"_id": ObjectId(recipient_id)})
            if user:
                notification = {
                    "userId": recipient_id,
                    "type": "route_shared",
                    "title": f"{sender_name} shared a route with you!",
                    "message": f"Check out '{route['name']}' - {route['description'][:100]}",
                    "routeId": route_id,
                    "isRead": False,
                    "createdAt": datetime.utcnow().isoformat()
                }
                notifications.append(notification)

                if user.get("pushToken"):
                    try:
                        await send_push_notification(
                            user["pushToken"],
                            notification["title"],
                            notification["message"],
                            {"type": "route_shared", "routeId": route_id}
                        )
                    except Exception as e:
                        print(f"Failed to send push notification: {e}")

    if notifications:
        await db.notifications.insert_many(notifications)

    return {"message": f"Route shared with {len(notifications)} users"}
