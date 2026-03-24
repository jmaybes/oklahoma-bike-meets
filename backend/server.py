from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
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
from routes.websocket import router as websocket_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create the main app
app = FastAPI(title="Oklahoma Car Events API")

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

# Include the API router in the main app
app.include_router(api_router)

# Include WebSocket router directly on app (no /api prefix)
app.include_router(websocket_router)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
