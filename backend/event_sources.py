"""
Event Source Integration Module

This module provides functionality to fetch bike events from external sources.
Currently supports:
- Manual data entry via admin API
- Future: Eventbrite API integration
- Future: Facebook Events scraping
- Future: Local bike club websites

For production, you would need to:
1. Register for Eventbrite API key at https://www.eventbrite.com/platform/api
2. Set up Facebook Graph API access
3. Create web scrapers for local bike club websites
"""

import asyncio
import httpx
from datetime import datetime
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)

# ==================== Eventbrite Integration ====================
# To enable: Set EVENTBRITE_API_KEY environment variable

async def fetch_eventbrite_events(
    api_key: str,
    location: str = "Oklahoma City",
    categories: List[str] = ["automotive", "car", "vehicle"]
) -> List[Dict]:
    """
    Fetch car-related events from Eventbrite API
    
    Note: Requires Eventbrite API key
    API Docs: https://www.eventbrite.com/platform/api
    """
    if not api_key:
        logger.warning("Eventbrite API key not configured")
        return []
    
    events = []
    base_url = "https://www.eventbriteapi.com/v3"
    
    async with httpx.AsyncClient() as client:
        for category in categories:
            try:
                response = await client.get(
                    f"{base_url}/events/search/",
                    params={
                        "q": category,
                        "location.address": location,
                        "location.within": "50mi",
                        "expand": "venue",
                    },
                    headers={"Authorization": f"Bearer {api_key}"},
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    for event in data.get("events", []):
                        events.append({
                            "title": event.get("name", {}).get("text", ""),
                            "description": event.get("description", {}).get("text", "")[:500],
                            "date": event.get("start", {}).get("local", "")[:10],
                            "time": event.get("start", {}).get("local", "")[11:16] if "T" in event.get("start", {}).get("local", "") else "",
                            "location": event.get("venue", {}).get("name", ""),
                            "address": event.get("venue", {}).get("address", {}).get("localized_address_display", ""),
                            "city": "Oklahoma City",
                            "source": "eventbrite",
                            "sourceId": event.get("id"),
                            "website": event.get("url", ""),
                        })
            except Exception as e:
                logger.error(f"Error fetching from Eventbrite: {e}")
    
    return events


# ==================== Common Event Sources for OKC ====================
# These are well-known sources for bike events in the Oklahoma City area

OKC_CAR_EVENT_SOURCES = [
    {
        "name": "Cars and Coffee OKC",
        "type": "recurring",
        "frequency": "weekly",
        "day": "Saturday",
        "time": "8:00 AM",
        "location": "Various locations",
        "website": "https://www.facebook.com/carsandcoffeeokc",
    },
    {
        "name": "OKC Drags",
        "type": "venue",
        "location": "Thunder Valley Raceway Park",
        "address": "13401 S Hiwassee Rd, Oklahoma City, OK",
        "website": "https://www.thundervalleyracewaypark.com",
    },
    {
        "name": "Caffeine and Octane OKC",
        "type": "recurring",
        "frequency": "monthly",
        "location": "Quail Springs Mall",
        "website": "https://www.caffeineandoctane.com",
    },
]


# ==================== Sample Event Data Generator ====================
# For demo purposes, generates sample events

def generate_sample_events() -> List[Dict]:
    """
    Generate sample bike events for demonstration purposes.
    In production, this would be replaced with real API integrations.
    """
    from datetime import timedelta
    import random
    
    event_templates = [
        {
            "title": "Cars & Coffee Morning Meet",
            "description": "Join fellow riders for our weekly Cars & Coffee event! Bring your classic, exotic, or tuned ride to show off. Free coffee for participants!",
            "location": "Quail Springs Mall",
            "address": "2501 W Memorial Rd, Oklahoma City, OK 73134",
            "eventType": "Bike Meet",
        },
        {
            "title": "Muscle Car Cruise Night",
            "description": "Classic American muscle cars only! Cruise through OKC with fellow muscle car owners. Route ends with a BBQ dinner.",
            "location": "Route 66 Park",
            "address": "3770 Lake Hefner Pkwy, Oklahoma City, OK 73116",
            "eventType": "Group Ride",
        },
        {
            "title": "Import Tuner Showcase",
            "description": "JDM, Euro, and Korean imports welcome! Show off your build and meet other import enthusiasts. Prizes for best in show.",
            "location": "Bricktown Parking Lot",
            "address": "121 E California Ave, Oklahoma City, OK 73104",
            "eventType": "Bike Show",
        },
        {
            "title": "Classic Car Swap Meet",
            "description": "Buy, sell, and trade classic car parts. Vendors from across Oklahoma. Food trucks on site.",
            "location": "State Fair Park",
            "address": "3001 General Pershing Blvd, Oklahoma City, OK 73107",
            "eventType": "Swap Meet",
        },
        {
            "title": "Truck & SUV Off-Road Day",
            "description": "Test your truck or SUV on our off-road course! All 4x4 vehicles welcome. Safety equipment required.",
            "location": "Rush Springs Ranch",
            "address": "Rural Route 3, Oklahoma City, OK",
            "eventType": "Bike Meet",
        },
    ]
    
    events = []
    base_date = datetime.now()
    
    for i, template in enumerate(event_templates):
        event_date = base_date + timedelta(days=random.randint(7, 90))
        events.append({
            **template,
            "date": event_date.strftime("%Y-%m-%d"),
            "time": random.choice(["8:00 AM", "9:00 AM", "6:00 PM", "7:00 PM"]),
            "city": "Oklahoma City",
            "latitude": 35.4676 + random.uniform(-0.1, 0.1),
            "longitude": -97.5164 + random.uniform(-0.1, 0.1),
            "organizer": f"OKC Bike Club #{i+1}",
            "entryFee": random.choice(["Free", "$5", "$10", "$20"]),
            "carTypes": random.sample(
                ["All Cars", "Muscle Cars", "Imports", "Classics", "Trucks", "Exotics"],
                random.randint(1, 3)
            ),
            "source": "auto_generated",
            "isApproved": False,  # Require admin approval
        })
    
    return events


async def import_events_from_sources(db) -> Dict:
    """
    Import events from configured sources into the database.
    Returns statistics about imported events.
    """
    import os
    
    stats = {
        "total": 0,
        "new": 0,
        "duplicates": 0,
        "errors": 0,
    }
    
    all_events = []
    
    # Try Eventbrite if API key is available
    eventbrite_key = os.getenv("EVENTBRITE_API_KEY")
    if eventbrite_key:
        eventbrite_events = await fetch_eventbrite_events(eventbrite_key)
        all_events.extend(eventbrite_events)
        logger.info(f"Fetched {len(eventbrite_events)} events from Eventbrite")
    
    # For demo, add sample events
    sample_events = generate_sample_events()
    all_events.extend(sample_events)
    
    stats["total"] = len(all_events)
    
    for event in all_events:
        try:
            # Check for duplicates by title and date
            existing = await db.events.find_one({
                "title": event["title"],
                "date": event["date"]
            })
            
            if existing:
                stats["duplicates"] += 1
                continue
            
            # Add creation timestamp
            event["createdAt"] = datetime.utcnow().isoformat()
            event["isApproved"] = False
            event["attendeeCount"] = 0
            event["photos"] = []
            
            await db.events.insert_one(event)
            stats["new"] += 1
            
        except Exception as e:
            logger.error(f"Error importing event: {e}")
            stats["errors"] += 1
    
    return stats


# ==================== CLI for manual import ====================
if __name__ == "__main__":
    import motor.motor_asyncio
    from dotenv import load_dotenv
    import os
    
    load_dotenv()
    
    async def main():
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        client = motor.motor_asyncio.AsyncIOMotorClient(mongo_url)
        db = client[os.environ.get("DB_NAME", "test_database")]
        
        print("Importing events from sources...")
        stats = await import_events_from_sources(db)
        print(f"Import complete: {stats}")
        
        client.close()
    
    asyncio.run(main())
