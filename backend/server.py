from fastapi import FastAPI, APIRouter, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
import asyncio
import logging

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
APP_VERSION = "v2.2.0-fork1-2026-04-05"

# Health check endpoint for Kubernetes probes
@app.get("/api/health")
async def health_check():
    """Health check that also tests database connectivity."""
    try:
        from database import db
        # Quick DB ping to verify connectivity
        await db.command("ping")
        return {"status": "ok", "version": APP_VERSION, "db": "connected"}
    except Exception as e:
        logger.error(f"Health check DB failure: {e}")
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "version": APP_VERSION, "db": str(e)}
        )

@app.get("/healthz")
async def health_check_k8s():
    return {"status": "ok", "version": APP_VERSION}

@app.get("/api/version")
async def get_version():
    return {"version": APP_VERSION, "note": "If you see this, the new code IS deployed"}

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
    """App startup - scheduler disabled to reduce container memory/stability issues."""
    logger.info(f"========== APP STARTING: {APP_VERSION} ==========")
    logger.info(f"========== BUILD ID: deploy-fix-april3-v8 ==========")
    logger.info("App started successfully (RSVP scheduler disabled for stability)")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
