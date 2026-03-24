from fastapi import APIRouter, HTTPException, Query
from typing import List
from datetime import datetime
from bson import ObjectId
import os
import logging

from database import db
from helpers import event_helper, send_push_notification

logger = logging.getLogger(__name__)

router = APIRouter()


# ==================== Admin Event Management ====================

@router.get("/admin/events/pending")
async def get_pending_events(admin_id: str = Query(...), source: str = Query(None)):
    """Get pending events for admin approval. Optional 'source' filter."""
    if not ObjectId.is_valid(admin_id):
        raise HTTPException(status_code=400, detail="Invalid admin ID")

    admin = await db.users.find_one({"_id": ObjectId(admin_id)})
    if not admin or not admin.get("isAdmin", False):
        raise HTTPException(status_code=403, detail="Unauthorized - Admin access required")

    query = {"isApproved": False}
    if source:
        query["source"] = source

    pending_events = await db.events.find(query).sort("createdAt", -1).to_list(1000)
    events = [event_helper(event) for event in pending_events]
    return {"events": events, "count": len(events)}


@router.put("/admin/events/{event_id}/approve")
async def approve_event_general(event_id: str, admin_id: str = Query(...)):
    """Approve a user-submitted event (PUT method)"""
    if not ObjectId.is_valid(admin_id):
        raise HTTPException(status_code=400, detail="Invalid admin ID")

    admin = await db.users.find_one({"_id": ObjectId(admin_id)})
    if not admin or not admin.get("isAdmin", False):
        raise HTTPException(status_code=403, detail="Unauthorized - Admin access required")

    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")

    result = await db.events.update_one(
        {"_id": ObjectId(event_id)},
        {"$set": {"isApproved": True, "approvedAt": datetime.utcnow().isoformat()}}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")

    updated_event = await db.events.find_one({"_id": ObjectId(event_id)})

    # If it's a Pop Up event, send notifications to all users
    if updated_event.get("isPopUp"):
        users = await db.users.find({"notificationsEnabled": {"$ne": False}}).to_list(10000)

        notifications = []
        for user in users:
            if str(user["_id"]) != updated_event.get("userId"):
                notification = {
                    "userId": str(user["_id"]),
                    "eventId": event_id,
                    "type": "popup_event",
                    "title": f"\U0001f6a8 Pop Up Event: {updated_event['title']}",
                    "message": f"{updated_event['eventType']} happening {updated_event['date']} at {updated_event['time']} in {updated_event['city']}!",
                    "isRead": False,
                    "createdAt": datetime.utcnow().isoformat()
                }
                notifications.append(notification)

        if notifications:
            await db.notifications.insert_many(notifications)

    return event_helper(updated_event)


@router.post("/admin/events/{event_id}/approve")
async def approve_event_discovered(event_id: str, admin_id: str = Query(...)):
    """Approve a discovered event from automated search (POST method)"""
    if not ObjectId.is_valid(admin_id):
        raise HTTPException(status_code=400, detail="Invalid admin ID")

    admin = await db.users.find_one({"_id": ObjectId(admin_id)})
    if not admin or not admin.get("isAdmin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")

    from event_search_service import approve_discovered_event
    success = await approve_discovered_event(db, event_id)
    if success:
        return {"success": True, "message": "Event approved successfully"}
    raise HTTPException(status_code=404, detail="Event not found")


@router.delete("/admin/events/{event_id}/reject")
async def reject_event(event_id: str, admin_id: str = Query(...)):
    """Reject and delete an event"""
    if not ObjectId.is_valid(admin_id):
        raise HTTPException(status_code=400, detail="Invalid admin ID")

    admin = await db.users.find_one({"_id": ObjectId(admin_id)})
    if not admin or not admin.get("isAdmin", False):
        raise HTTPException(status_code=403, detail="Unauthorized - Admin access required")

    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")

    result = await db.events.delete_one({"_id": ObjectId(event_id)})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")

    return {"success": True, "message": "Event rejected and deleted"}


@router.post("/admin/events/approve-all")
async def approve_all_pending_events(admin_id: str = Query(...)):
    """Approve all pending discovered events at once"""
    if not ObjectId.is_valid(admin_id):
        raise HTTPException(status_code=400, detail="Invalid admin ID")

    admin = await db.users.find_one({"_id": ObjectId(admin_id)})
    if not admin or not admin.get("isAdmin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    result = await db.events.update_many(
        {"isApproved": False, "source": "auto_search"},
        {"$set": {"isApproved": True, "approvedAt": datetime.utcnow().isoformat()}}
    )

    return {
        "success": True,
        "message": f"Approved {result.modified_count} events",
        "count": result.modified_count
    }


# ==================== Admin Club Management ====================

@router.get("/admin/clubs/pending")
async def get_pending_clubs(admin_id: str = Query(...)):
    if not ObjectId.is_valid(admin_id):
        raise HTTPException(status_code=400, detail="Invalid admin ID")

    admin = await db.users.find_one({"_id": ObjectId(admin_id)})
    if not admin or not admin.get("isAdmin", False):
        raise HTTPException(status_code=403, detail="Unauthorized - Admin access required")

    pending_clubs = await db.clubs.find({"isApproved": False}).sort("createdAt", -1).to_list(1000)
    return [{
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
        "createdAt": club.get("createdAt")
    } for club in pending_clubs]


@router.put("/admin/clubs/{club_id}/approve")
async def approve_club(club_id: str, admin_id: str = Query(...)):
    if not ObjectId.is_valid(admin_id):
        raise HTTPException(status_code=400, detail="Invalid admin ID")

    admin = await db.users.find_one({"_id": ObjectId(admin_id)})
    if not admin or not admin.get("isAdmin", False):
        raise HTTPException(status_code=403, detail="Unauthorized - Admin access required")

    if not ObjectId.is_valid(club_id):
        raise HTTPException(status_code=400, detail="Invalid club ID")

    result = await db.clubs.update_one(
        {"_id": ObjectId(club_id)},
        {"$set": {"isApproved": True}}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Club not found")

    updated_club = await db.clubs.find_one({"_id": ObjectId(club_id)})
    return {
        "id": str(updated_club["_id"]),
        "name": updated_club["name"],
        "description": updated_club["description"],
        "location": updated_club["location"],
        "city": updated_club["city"],
        "carTypes": updated_club.get("carTypes", []),
        "contactInfo": updated_club.get("contactInfo", ""),
        "website": updated_club.get("website", ""),
        "facebookGroup": updated_club.get("facebookGroup", ""),
        "meetingSchedule": updated_club.get("meetingSchedule", ""),
        "memberCount": updated_club.get("memberCount", ""),
        "isApproved": updated_club.get("isApproved", False),
        "createdAt": updated_club.get("createdAt")
    }


@router.delete("/admin/clubs/{club_id}/reject")
async def reject_club(club_id: str, admin_id: str = Query(...)):
    if not ObjectId.is_valid(admin_id):
        raise HTTPException(status_code=400, detail="Invalid admin ID")

    admin = await db.users.find_one({"_id": ObjectId(admin_id)})
    if not admin or not admin.get("isAdmin", False):
        raise HTTPException(status_code=403, detail="Unauthorized - Admin access required")

    if not ObjectId.is_valid(club_id):
        raise HTTPException(status_code=400, detail="Invalid club ID")

    result = await db.clubs.delete_one({"_id": ObjectId(club_id)})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Club not found")

    return {"message": "Club rejected and deleted"}


# ==================== Event Import ====================

@router.post("/admin/events/import")
async def import_events(admin_id: str = Query(...)):
    """Import events from external sources. Admin only."""
    from event_sources import import_events_from_sources

    if not ObjectId.is_valid(admin_id):
        raise HTTPException(status_code=400, detail="Invalid admin ID")

    admin = await db.users.find_one({"_id": ObjectId(admin_id)})
    if not admin or not admin.get("isAdmin", False):
        raise HTTPException(status_code=403, detail="Unauthorized - Admin access required")

    try:
        stats = await import_events_from_sources(db)
        return {
            "message": "Event import completed",
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


# ==================== Automated Event Search ====================

@router.post("/admin/events/search")
async def trigger_event_search(admin_id: str = Query(...)):
    """Manually trigger the automated event search. Admin only."""
    if not ObjectId.is_valid(admin_id):
        raise HTTPException(status_code=400, detail="Invalid admin ID")

    admin = await db.users.find_one({"_id": ObjectId(admin_id)})
    if not admin or not admin.get("isAdmin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        from event_search_service import run_automated_event_search
        stats = await run_automated_event_search(db)
        return {
            "success": True,
            "message": f"Event search completed. Found {stats['events_found']} events, imported {stats['events_imported']} new events.",
            "stats": stats
        }
    except Exception as e:
        logger.error(f"Event search error: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/admin/events/search-logs")
async def get_event_search_logs(admin_id: str = Query(...), limit: int = Query(10)):
    """Get recent event search logs"""
    if not ObjectId.is_valid(admin_id):
        raise HTTPException(status_code=400, detail="Invalid admin ID")

    admin = await db.users.find_one({"_id": ObjectId(admin_id)})
    if not admin or not admin.get("isAdmin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    from event_search_service import get_search_logs
    logs = await get_search_logs(db, limit)
    return {"logs": logs}


# ==================== Scheduler ====================

@router.post("/scheduler/weekly-event-search")
async def scheduled_weekly_search(secret_key: str = Query(...)):
    """Weekly scheduled event search - call this from a cron job."""
    expected_key = os.getenv("SCHEDULER_SECRET_KEY", "okc-car-events-weekly-search-2025")
    if secret_key != expected_key:
        raise HTTPException(status_code=403, detail="Invalid scheduler key")

    try:
        from event_search_service import run_automated_event_search
        stats = await run_automated_event_search(db)

        if stats.get("events_imported", 0) > 0:
            admins = await db.users.find({"isAdmin": True}).to_list(100)
            for admin in admins:
                notification = {
                    "userId": str(admin["_id"]),
                    "type": "admin_alert",
                    "title": "New Events Discovered",
                    "message": f"Weekly search found {stats['events_imported']} new events pending your approval.",
                    "isRead": False,
                    "createdAt": datetime.utcnow().isoformat()
                }
                await db.notifications.insert_one(notification)

        return {
            "success": True,
            "message": "Weekly event search completed",
            "stats": stats
        }
    except Exception as e:
        logger.error(f"Scheduled search error: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
