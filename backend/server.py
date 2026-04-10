from fastapi import FastAPI, APIRouter, Request
from fastapi.responses import JSONResponse, FileResponse
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
import asyncio
import logging
import os

from database import client

# Import all route modules
from routes.events import router as events_router
from routes.event_gallery import router as event_gallery_router
from routes.auth import router as auth_router
from routes.rsvp import router as rsvp_router
from routes.notifications import router as notifications_router
from routes.nearby import router as nearby_router
from routes.messaging import router as messaging_router
from routes.garage import router as garage_router
from routes.performance import router as performance_router
from routes.clubs import router as clubs_router
from routes.feedback import router as feedback_router
from routes.route_planning import router as route_planning_router
from routes.admin import router as admin_router
from routes.feeds import router as feeds_router
from routes.websocket import router as websocket_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create the main app
app = FastAPI(title="Oklahoma Car Events API")

# GZip compression middleware - reduces response sizes by 80-90%
# Critical for base64 photo payloads to prevent OOM kills
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Include all route modules in the API router
api_router.include_router(events_router)
api_router.include_router(event_gallery_router)
api_router.include_router(auth_router)
api_router.include_router(rsvp_router)
api_router.include_router(notifications_router)
api_router.include_router(nearby_router)
api_router.include_router(messaging_router)
api_router.include_router(garage_router)
api_router.include_router(performance_router)
api_router.include_router(clubs_router)
api_router.include_router(feedback_router)
api_router.include_router(route_planning_router)
api_router.include_router(admin_router)
api_router.include_router(feeds_router)

# Include the API router in the main app
app.include_router(api_router)

# Include WebSocket router directly on app (no /api prefix)
app.include_router(websocket_router)

# Version marker - change this to verify deployments are picking up new code
APP_VERSION = "v2.3.0-fork1-UNIQUE-SERVER-42"
BUILD_ID = "emergent-event-hub-okc-1-april6"

# Health check endpoint for Kubernetes probes
@app.get("/api/health")
async def health_check():
    """Health check that also tests database connectivity."""
    try:
        from database import db
        # Quick DB ping to verify connectivity
        await db.command("ping")
        return {"status": "ok", "version": APP_VERSION, "build": BUILD_ID, "db": "connected"}
    except Exception as e:
        logger.error(f"Health check DB failure: {e}")
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "version": APP_VERSION, "db": str(e)}
        )

@app.get("/healthz")
async def health_check_k8s():
    return {"status": "ok", "version": APP_VERSION}

@app.get("/api/download-db")
async def download_db():
    """Temporary endpoint to download database export"""
    file_path = os.path.join(os.path.dirname(__file__), "db_export.tar.gz")
    if os.path.exists(file_path):
        return FileResponse(file_path, filename="db_export.tar.gz", media_type="application/gzip")
    return JSONResponse(status_code=404, content={"detail": "No export found"})


@app.get("/api/version")
async def get_version():
    return {"version": APP_VERSION, "build": BUILD_ID, "server": "event-hub-okc-1"}

@app.get("/api/debug")
async def debug_info():
    """Open this URL on your phone browser to verify which server you're hitting."""
    from database import db
    car_count = await db.user_cars.count_documents({})
    user_count = await db.users.count_documents({})
    top_car = await db.user_cars.find_one(
        {"$or": [{"isPublic": True}, {"isPublic": "true"}]},
        {"make": 1, "model": 1, "year": 1, "likes": 1}
    , sort=[("likes", -1)])
    return {
        "server": "event-hub-okc-1",
        "build": BUILD_ID,
        "version": APP_VERSION,
        "database": "test_database",
        "users": user_count,
        "cars": car_count,
        "top_car": f"{top_car.get('year')} {top_car.get('make')} {top_car.get('model')} ({top_car.get('likes')} likes)" if top_car else "none"
    }

# Global exception handler - catches ALL unhandled exceptions to prevent crashes
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    exc_name = type(exc).__name__
    if "DocumentTooLarge" in exc_name:
        return JSONResponse(
            status_code=413,
            content={"detail": "Document too large. Please reduce photo sizes or count."}
        )
    logger.error(f"Unhandled {exc_name} on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )


# ==================== Background Scheduler ====================

_scheduler_task = None

async def rsvp_reminder_scheduler():
    """Background task that checks for RSVP reminders every hour."""
    from datetime import datetime, timedelta
    from bson import ObjectId
    from database import db
    from helpers import send_push_notification

    while True:
        try:
            # Check every hour
            await asyncio.sleep(3600)

            tomorrow = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")

            rsvps = await db.rsvps.find({
                "eventDate": tomorrow,
                "reminderSent": False
            }).to_list(100)  # Limit to 100 to prevent memory spikes

            if not rsvps:
                continue

            reminders_sent = 0
            for rsvp in rsvps:
                try:
                    user = await db.users.find_one({"_id": ObjectId(rsvp["userId"])})
                    if user and user.get("notificationsEnabled", True):
                        notification = {
                            "userId": rsvp["userId"],
                            "type": "event_reminder",
                            "title": f"Reminder: {rsvp['eventTitle']} is Tomorrow!",
                            "message": f"Don't forget! {rsvp['eventTitle']} is happening tomorrow at {rsvp['eventTime']} at {rsvp['eventLocation']}",
                            "eventId": rsvp["eventId"],
                            "isRead": False,
                            "createdAt": datetime.utcnow().isoformat()
                        }
                        await db.notifications.insert_one(notification)

                        if user.get("pushToken"):
                            try:
                                await send_push_notification(
                                    user["pushToken"],
                                    notification["title"],
                                    notification["message"],
                                    {"eventId": rsvp["eventId"], "type": "event_reminder"}
                                )
                            except Exception as e:
                                logger.error(f"Failed to send reminder push: {e}")

                        reminders_sent += 1

                    await db.rsvps.update_one(
                        {"_id": rsvp["_id"]},
                        {"$set": {"reminderSent": True}}
                    )
                except Exception as e:
                    logger.error(f"Error processing RSVP reminder: {e}")
                    continue

            if reminders_sent > 0:
                logger.info(f"RSVP Scheduler: Sent {reminders_sent} reminder notifications")

        except asyncio.CancelledError:
            logger.info("RSVP scheduler cancelled")
            break
        except Exception as e:
            logger.error(f"RSVP Scheduler error: {e}")
            await asyncio.sleep(60)  # Wait a minute before retrying on error


@app.on_event("startup")
async def startup_scheduler():
    """App startup - run database migrations and initialize."""
    logger.info(f"========== APP STARTING: {APP_VERSION} ==========")
    logger.info(f"========== BUILD ID: deploy-fix-april3-v8 ==========")
    
    # Auto-cleanup corrupted car records that crash the garage endpoint
    await cleanup_corrupted_cars()
    
    # Run photo migration to fix cars missing photoCount/thumbnail
    await migrate_photo_counts()
    
    logger.info("App started successfully (RSVP scheduler disabled for stability)")


async def cleanup_corrupted_cars():
    """
    Startup cleanup: Finds and removes car records with corrupted data
    (non-array photos, missing required fields) that crash the public garages endpoint.
    """
    from database import db
    
    try:
        # Find cars where photos field exists but is NOT an array
        corrupted_cars = await db.user_cars.find({
            "$or": [
                {"photos": {"$exists": True, "$not": {"$type": "array"}}},
                {"make": {"$exists": False}},
                {"model": {"$exists": False}},
            ]
        }, {"make": 1, "model": 1, "userId": 1}).to_list(100)
        
        if corrupted_cars:
            car_ids = [car["_id"] for car in corrupted_cars]
            names = [f"{c.get('make','?')} {c.get('model','?')}" for c in corrupted_cars]
            
            # Delete corrupted cars
            result = await db.user_cars.delete_many({"_id": {"$in": car_ids}})
            
            # Also delete their comments
            car_id_strs = [str(cid) for cid in car_ids]
            await db.garage_comments.delete_many({"carId": {"$in": car_id_strs}})
            
            logger.warning(f"CLEANUP: Removed {result.deleted_count} corrupted cars: {names}")
        else:
            logger.info("Cleanup: No corrupted car records found")
            
    except Exception as e:
        logger.error(f"Cleanup error (non-fatal): {e}")


async def migrate_photo_counts():
    """
    Database migration: Ensures every car with photos has correct photoCount 
    and thumbnail fields. Fixes the root cause of 'no photos on native' bug.
    """
    from database import db
    from helpers import make_thumbnail_base64
    
    try:
        # Find all cars that have photos array with items
        cars_with_photos = await db.user_cars.find(
            {"photos": {"$exists": True, "$ne": []}},
            {"photos": 1, "photoCount": 1, "thumbnail": 1, "make": 1, "model": 1}
        ).to_list(500)
        
        fixed = 0
        for car in cars_with_photos:
            car_id = car["_id"]
            actual_count = len(car.get("photos", []))
            stored_count = car.get("photoCount")
            has_thumbnail = bool(car.get("thumbnail"))
            
            updates = {}
            
            # Fix photoCount if missing or wrong
            if stored_count is None or stored_count != actual_count:
                updates["photoCount"] = actual_count
            
            # Generate thumbnail if missing
            if not has_thumbnail and actual_count > 0:
                try:
                    first_photo = car["photos"][0]
                    if first_photo and len(str(first_photo)) > 100:
                        thumb = make_thumbnail_base64(first_photo)
                        if thumb:
                            updates["thumbnail"] = thumb
                except Exception as e:
                    logger.warning(f"Could not generate thumbnail for car {car_id}: {e}")
            
            if updates:
                await db.user_cars.update_one(
                    {"_id": car_id},
                    {"$set": updates}
                )
                fixed += 1
                name = f"{car.get('make', '?')} {car.get('model', '?')}"
                logger.info(f"  Fixed car '{name}' ({car_id}): {list(updates.keys())}")
        
        if fixed > 0:
            logger.info(f"Photo migration: Fixed {fixed} cars")
        else:
            logger.info("Photo migration: All cars OK, no fixes needed")
            
    except Exception as e:
        logger.error(f"Photo migration error (non-fatal): {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
