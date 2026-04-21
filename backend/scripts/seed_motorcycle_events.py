"""
Seed Script for Oklahoma Motorcycle Events
Run this script to populate the database with curated 2025-2026 motorcycle events.
"""

import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Motorcycle image URLs
MOTORCYCLE_IMAGES = [
    "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800",
    "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=800",
    "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800",
    "https://images.unsplash.com/photo-1449426468159-d96dbf08f19f?w=800",
    "https://images.unsplash.com/photo-1547549082-6bc09f2049ae?w=800",
    "https://images.unsplash.com/photo-1609630875171-b1321377ee65?w=800",
    "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800",
    "https://images.unsplash.com/photo-1525160354320-d8e92641c563?w=800",
    "https://images.unsplash.com/photo-1558980664-ce6960be307d?w=800",
    "https://images.unsplash.com/photo-1558981852-426c6c22a060?w=800",
]

# Real 2025-2026 Oklahoma Motorcycle Events
SEED_EVENTS = [
    # ==================== RECURRING WEEKLY BIKE NIGHTS ====================
    {
        "title": "Frosted Mug Bike Night",
        "description": "Weekly bike night at Frosted Mug in OKC. All motorcycles welcome for this family-friendly gathering. Great food, drinks, and fellow riders.",
        "date": "2025-06-25",
        "time": "3:00 PM - 9:00 PM",
        "location": "Frosted Mug",
        "address": "1800 S Meridian Ave, Oklahoma City, OK 73108",
        "city": "Oklahoma City",
        "eventType": "Bike Night",
        "entryFee": "Free",
        "bikeTypes": ["All Motorcycles"],
        "photos": [MOTORCYCLE_IMAGES[9]],
        "isRecurring": True,
        "recurrenceDay": 3,
        "isApproved": True
    },
    {
        "title": "Jamesville Y Bar Bike Night",
        "description": "Thursday evening bike night near Tulsa. Great atmosphere for riders to connect and enjoy the evening together.",
        "date": "2025-06-26",
        "time": "6:00 PM - 9:00 PM",
        "location": "Jamesville Y Bar",
        "address": "Hwy 72 & Taft Rd, Haskell, OK",
        "city": "Haskell",
        "eventType": "Bike Night",
        "entryFee": "Free",
        "bikeTypes": ["All Motorcycles"],
        "photos": [MOTORCYCLE_IMAGES[4]],
        "isRecurring": True,
        "recurrenceDay": 4,
        "isApproved": True
    },
    {
        "title": "Rock Away Tavern Old School Bike Night",
        "description": "Old school motorcycles featured at this weekly Thursday gathering near Guthrie. Classic bikes and great people.",
        "date": "2025-06-26",
        "time": "6:00 PM - 9:00 PM",
        "location": "Rock Away Tavern",
        "address": "7802 S Sooner Rd, Guthrie, OK",
        "city": "Guthrie",
        "eventType": "Bike Night",
        "entryFee": "Free",
        "bikeTypes": ["Vintage", "Classic", "All Motorcycles"],
        "photos": [MOTORCYCLE_IMAGES[7]],
        "isRecurring": True,
        "recurrenceDay": 4,
        "isApproved": True
    },
    {
        "title": "Road House Saturday Bike Night",
        "description": "Saturday evening bike night in OKC with free food at 8 PM! Live music and great atmosphere for riders.",
        "date": "2025-06-28",
        "time": "6:30 PM",
        "location": "Road House",
        "address": "6716 Main St, Oklahoma City, OK",
        "city": "Oklahoma City",
        "eventType": "Bike Night",
        "entryFee": "Free",
        "bikeTypes": ["All Motorcycles"],
        "photos": [MOTORCYCLE_IMAGES[5]],
        "isRecurring": True,
        "recurrenceDay": 6,
        "isApproved": True
    },
    {
        "title": "Biker Heaven Saturday Meetup",
        "description": "Weekly Saturday meetup at Biker Heaven in Tulsa. Free drinks for riders, plus check out their motorcycle gear and accessories.",
        "date": "2025-06-28",
        "time": "10:00 AM - 5:00 PM",
        "location": "Biker Heaven",
        "address": "121 Sam Nobel Pkwy, Tulsa, OK",
        "city": "Tulsa",
        "eventType": "Bike Night",
        "entryFee": "Free",
        "bikeTypes": ["All Motorcycles"],
        "photos": [MOTORCYCLE_IMAGES[0]],
        "isRecurring": True,
        "recurrenceDay": 6,
        "isApproved": True
    },
    {
        "title": "Bikes on Bell Shawnee",
        "description": "Weekly Wednesday bike night in Shawnee. Great evening gathering spot for local riders.",
        "date": "2025-06-25",
        "time": "6:00 PM - 11:00 PM",
        "location": "Bikes on Bell",
        "address": "100 N Bell Ave, Shawnee, OK",
        "city": "Shawnee",
        "eventType": "Bike Night",
        "entryFee": "Free",
        "bikeTypes": ["All Motorcycles"],
        "photos": [MOTORCYCLE_IMAGES[9]],
        "isRecurring": True,
        "recurrenceDay": 3,
        "isApproved": True
    },
    
    # ==================== 2025 MAJOR EVENTS ====================
    {
        "title": "Oklahoma Bike Week - Rally for Veterans 2025",
        "description": "Veterans-focused motorcycle rally at the Route 66 Rally Grounds. Features live bands, vendors, camping, and all-weather amenities. Support our veterans while riding!",
        "date": "2025-06-26",
        "time": "12:00 PM",
        "location": "Route 66 Rally Grounds",
        "address": "26101 Milfay Rd, Depew, OK",
        "city": "Depew",
        "eventType": "Motorcycle Rally",
        "entryFee": "$50+",
        "organizer": "Route 66 Rallies",
        "website": "https://route66rallies.com",
        "bikeTypes": ["All Motorcycles"],
        "photos": [MOTORCYCLE_IMAGES[5]],
        "isApproved": True
    },
    {
        "title": "After Sturgis Party 2025",
        "description": "The ultimate post-Sturgis celebration! Continue the party at Route 66 Rally Grounds with live bands, bike games, vendors, and camping. 21+ adults only event.",
        "date": "2025-08-14",
        "time": "12:00 PM",
        "location": "Route 66 Rally Grounds",
        "address": "26101 Milfay Rd, Depew, OK",
        "city": "Depew",
        "eventType": "Motorcycle Rally",
        "entryFee": "$60+",
        "organizer": "Route 66 Rallies",
        "website": "https://route66rallies.com",
        "bikeTypes": ["All Motorcycles"],
        "photos": [MOTORCYCLE_IMAGES[5]],
        "isApproved": True
    },
    {
        "title": "3rd Annual HOG Roast and Poker Run 2025",
        "description": "Harley Owners Group charity event at Diamondback Harley-Davidson. Enjoy a poker run through scenic Oklahoma and support local causes.",
        "date": "2025-09-20",
        "time": "9:00 AM",
        "location": "Diamondback Harley-Davidson",
        "address": "Lawton, OK",
        "city": "Lawton",
        "eventType": "Poker Run",
        "entryFee": "$25",
        "organizer": "Diamondback Harley-Davidson",
        "website": "https://diamondbackharley.com",
        "bikeTypes": ["Harley-Davidson", "All Motorcycles"],
        "photos": [MOTORCYCLE_IMAGES[0]],
        "isApproved": True
    },
    {
        "title": "Fall Halloween Rally 2025",
        "description": "Halloween-themed biker rally with costume contests, live bands, vendors, and camping. Get spooky with fellow riders! 21+ adults only.",
        "date": "2025-10-16",
        "time": "12:00 PM",
        "location": "Route 66 Rally Grounds",
        "address": "26101 Milfay Rd, Depew, OK",
        "city": "Depew",
        "eventType": "Motorcycle Rally",
        "entryFee": "$50+",
        "organizer": "Route 66 Rallies",
        "website": "https://route66rallies.com",
        "bikeTypes": ["All Motorcycles"],
        "photos": [MOTORCYCLE_IMAGES[6]],
        "isApproved": True
    },
    {
        "title": "RockFest 2025",
        "description": "Music and motorcycle festival in Davis, Oklahoma. Multiple days of live rock music combined with the riding lifestyle.",
        "date": "2025-11-19",
        "time": "12:00 PM",
        "location": "Davis Event Grounds",
        "address": "Davis, OK",
        "city": "Davis",
        "eventType": "Motorcycle Rally",
        "entryFee": "$40+",
        "bikeTypes": ["All Motorcycles"],
        "photos": [MOTORCYCLE_IMAGES[5]],
        "isApproved": True
    },
    
    # ==================== 2026 MAJOR EVENTS ====================
    {
        "title": "Spring Cabin Fever Rally 2026",
        "description": "Kick off the riding season at Route 66 Rally Grounds! Shake off winter with live bands, vendors, camping, and the famous clothing-optional pond. 21+ adults only.",
        "date": "2026-03-12",
        "time": "12:00 PM",
        "location": "Route 66 Rally Grounds",
        "address": "26101 Milfay Rd, Depew, OK",
        "city": "Depew",
        "eventType": "Motorcycle Rally",
        "entryFee": "$50+",
        "organizer": "Route 66 Rallies",
        "website": "https://route66rallies.com",
        "bikeTypes": ["All Motorcycles"],
        "photos": [MOTORCYCLE_IMAGES[5]],
        "isApproved": True
    },
    {
        "title": "LAMA Poker Run 2026",
        "description": "Charity poker run starting at Diamondback Harley-Davidson in Lawton. Scenic ride through Oklahoma with prizes and community.",
        "date": "2026-04-11",
        "time": "9:00 AM",
        "location": "Diamondback Harley-Davidson",
        "address": "Lawton, OK",
        "city": "Lawton",
        "eventType": "Poker Run",
        "entryFee": "$20",
        "organizer": "Diamondback Harley-Davidson",
        "website": "https://diamondbackharley.com",
        "bikeTypes": ["All Motorcycles"],
        "photos": [MOTORCYCLE_IMAGES[4]],
        "isApproved": True
    },
    {
        "title": "Rollout at Route 66 Harley-Davidson 2026",
        "description": "See the new 2026 Harley-Davidson lineup! Features music, food, and family fun during the Tulsa Bike Rally weekend. Free admission.",
        "date": "2026-04-18",
        "time": "10:00 AM",
        "location": "Route 66 Harley-Davidson",
        "address": "Tulsa, OK",
        "city": "Tulsa",
        "eventType": "Bike Show",
        "entryFee": "Free",
        "organizer": "Route 66 Harley-Davidson",
        "website": "https://route66h-d.com",
        "bikeTypes": ["Harley-Davidson"],
        "photos": [MOTORCYCLE_IMAGES[0]],
        "isApproved": True
    },
    {
        "title": "16th Annual Harley Party for Boys & Girls Clubs 2026",
        "description": "Charity event benefiting Boys & Girls Clubs of Bartlesville. Win a chance for a 2025 Harley-Davidson Street Bob! Live music and great cause.",
        "date": "2026-04-25",
        "time": "11:00 AM",
        "location": "Bartlesville Event Center",
        "address": "Bartlesville, OK",
        "city": "Bartlesville",
        "eventType": "Charity Ride",
        "entryFee": "$30",
        "organizer": "Boys & Girls Clubs of Bartlesville",
        "bikeTypes": ["Harley-Davidson", "All Motorcycles"],
        "photos": [MOTORCYCLE_IMAGES[8]],
        "isApproved": True
    },
    {
        "title": "HVFD Red Line Poker Run & Rally 2026",
        "description": "Fire department charity poker run supporting local heroes. Scenic route through Oklahoma with rally at the end.",
        "date": "2026-04-25",
        "time": "9:00 AM",
        "location": "Walters Fire Department",
        "address": "Walters, OK",
        "city": "Walters",
        "eventType": "Poker Run",
        "entryFee": "$20",
        "organizer": "HVFD",
        "bikeTypes": ["All Motorcycles"],
        "photos": [MOTORCYCLE_IMAGES[4]],
        "isApproved": True
    },
    {
        "title": "BikeStock Oklahoma 2026",
        "description": "Old-school biker party on Route 66! Multiple days of live bands, contests, RV/tent camping, and the famous clothing-optional pond. 21+ adults only.",
        "date": "2026-04-30",
        "time": "12:00 PM",
        "location": "Route 66 Rally Grounds",
        "address": "26101 Milfay Rd, Depew, OK",
        "city": "Depew",
        "eventType": "Motorcycle Rally",
        "entryFee": "$60+",
        "organizer": "Route 66 Rallies",
        "website": "https://route66rallies.com",
        "bikeTypes": ["All Motorcycles"],
        "photos": [MOTORCYCLE_IMAGES[5]],
        "isApproved": True
    },
    {
        "title": "Black Wall Street Rally 2026",
        "description": "Historic motorcycle festival in Tulsa's Greenwood District. Features Harley demo rides, bike show, live music, vendors, history tours, sound competition, and concert. Celebrate Black Wall Street's legacy!",
        "date": "2026-05-14",
        "time": "10:00 AM",
        "location": "Historic Greenwood District",
        "address": "Greenwood Ave, Tulsa, OK",
        "city": "Tulsa",
        "eventType": "Motorcycle Rally",
        "entryFee": "$25+",
        "organizer": "Black Wall Street Rally",
        "website": "https://blackwallstreetrally.com",
        "bikeTypes": ["All Motorcycles", "Harley-Davidson"],
        "photos": [MOTORCYCLE_IMAGES[5]],
        "isApproved": True
    },
    {
        "title": "Route 66 Bike Week 2026",
        "description": "Major summer motorcycle rally on historic Route 66. Live bands, bike games, vendors, and camping at the famous Route 66 Rally Grounds. 21+ adults only.",
        "date": "2026-06-18",
        "time": "12:00 PM",
        "location": "Route 66 Rally Grounds",
        "address": "26101 Milfay Rd, Depew, OK",
        "city": "Depew",
        "eventType": "Motorcycle Rally",
        "entryFee": "$60+",
        "organizer": "Route 66 Rallies",
        "website": "https://route66rallies.com",
        "bikeTypes": ["All Motorcycles"],
        "photos": [MOTORCYCLE_IMAGES[5]],
        "isApproved": True
    },
    {
        "title": "Sturgis After Party 2026",
        "description": "Post-Sturgis celebration at Route 66 Rally Grounds. Continue the legendary ride with Oklahoma's biggest after-party. Live bands, vendors, camping. 21+ adults only.",
        "date": "2026-08-20",
        "time": "12:00 PM",
        "location": "Route 66 Rally Grounds",
        "address": "26101 Milfay Rd, Depew, OK",
        "city": "Depew",
        "eventType": "Motorcycle Rally",
        "entryFee": "$60+",
        "organizer": "Route 66 Rallies",
        "website": "https://route66rallies.com",
        "bikeTypes": ["All Motorcycles"],
        "photos": [MOTORCYCLE_IMAGES[5]],
        "isApproved": True
    },
    {
        "title": "Fall Biker Rally 2026",
        "description": "End the riding season in style at Route 66 Rally Grounds. Live bands, vendors, camping, and cooler weather riding. 21+ adults only.",
        "date": "2026-10-15",
        "time": "12:00 PM",
        "location": "Route 66 Rally Grounds",
        "address": "26101 Milfay Rd, Depew, OK",
        "city": "Depew",
        "eventType": "Motorcycle Rally",
        "entryFee": "$50+",
        "organizer": "Route 66 Rallies",
        "website": "https://route66rallies.com",
        "bikeTypes": ["All Motorcycles"],
        "photos": [MOTORCYCLE_IMAGES[6]],
        "isApproved": True
    }
]


async def seed_events():
    """Seed the database with motorcycle events"""
    mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client.test_database  # Using the same database as the main app
    
    print(f"Connected to MongoDB at {mongo_url}")
    print(f"Database: test_database")
    
    # Count existing events
    existing_count = await db.events.count_documents({})
    print(f"Existing events in database: {existing_count}")
    
    inserted_count = 0
    skipped_count = 0
    
    for event in SEED_EVENTS:
        # Check if event already exists (by title and date)
        existing = await db.events.find_one({
            "title": event["title"],
            "date": event["date"]
        })
        
        if existing:
            print(f"  SKIP: {event['title']} (already exists)")
            skipped_count += 1
            continue
        
        # Add metadata
        event["source"] = "seed_script"
        event["attendeeCount"] = 0
        event["createdAt"] = datetime.utcnow().isoformat()
        event["discoveredAt"] = datetime.utcnow().isoformat()
        
        # Insert event
        await db.events.insert_one(event)
        print(f"  ADD: {event['title']}")
        inserted_count += 1
    
    # Final count
    final_count = await db.events.count_documents({})
    
    print(f"\n=== SEED COMPLETE ===")
    print(f"Events inserted: {inserted_count}")
    print(f"Events skipped (duplicates): {skipped_count}")
    print(f"Total events in database: {final_count}")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(seed_events())
