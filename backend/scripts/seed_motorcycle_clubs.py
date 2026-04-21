"""
Seed Script for Oklahoma Motorcycle Clubs
Run this script to populate the database with Oklahoma motorcycle clubs.
"""

import asyncio
import os
import sys
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

# Club images - sport bikes and riding groups
CLUB_IMAGES = [
    "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800",  # Sport bikes
    "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=800",    # Sleek motorcycle
    "https://images.unsplash.com/photo-1558980664-769d59546b3d?w=800",    # Racing
    "https://images.unsplash.com/photo-1609630875171-b1321377ee65?w=800",  # Night rider
    "https://images.unsplash.com/photo-1547549082-6bc09f2049ae?w=800",    # Group ride
    "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800",    # Harley cruiser
    "https://images.unsplash.com/photo-1558981852-426c6c22a060?w=800",    # Motorcycle meet
    "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800",  # Chopper
]

# Real Oklahoma Motorcycle Clubs from web research
SEED_CLUBS = [
    # ==================== SPORT BIKE CLUBS ====================
    {
        "name": "Tulsa Sportbike Riders",
        "description": "Tulsa's premier sport bike riding group! We specialize in sport riding with a focus on sportbikes like R1, CBR, ZX, and GSX-R. Join us for group rides through the Ozarks, track days at Hallett, and weekly meetups.",
        "location": "Tulsa, OK",
        "city": "Tulsa",
        "bikeTypes": ["Sport Bikes", "Supersport", "Crotch Rockets"],
        "contactInfo": "Find us on Facebook: Tulsa Sportbike Riders",
        "website": "https://www.facebook.com/groups/tulsasportbikeriders",
        "facebookGroup": "Tulsa Sportbike Riders",
        "meetingSchedule": "Weekly rides - check Facebook for announcements",
        "focus": "Sport Riding",
        "memberCount": "3,000+",
        "photos": [CLUB_IMAGES[0], CLUB_IMAGES[2]],
        "isApproved": True
    },
    {
        "name": "OKC Sportbike Riders",
        "description": "Oklahoma City's dedicated sport bike community! We organize track days at Hallett Motor Racing Circuit, group rides on Route 66, and weekly meetups. All sport bike riders welcome - R1, R6, CBR, ZX, GSX-R, and more!",
        "location": "Oklahoma City, OK",
        "city": "Oklahoma City",
        "bikeTypes": ["Sport Bikes", "Supersport", "Crotch Rockets"],
        "contactInfo": "Find us on Facebook: OKC Sportbike Riders",
        "website": "https://www.facebook.com/groups/okcsportbikeriders",
        "facebookGroup": "OKC Sportbike Riders",
        "meetingSchedule": "Weekly ride announcements on Facebook",
        "focus": "Sport Riding, Track Days",
        "memberCount": "5,000+",
        "photos": [CLUB_IMAGES[0], CLUB_IMAGES[4]],
        "isApproved": True
    },
    {
        "name": "Oklahoma Sportbike Association",
        "description": "The official statewide organization for sport bike enthusiasts in Oklahoma. We coordinate OKC-Tulsa runs, Turnpike Twists, and advocate for rider safety. Join us for the OK Bike Rally and other major events!",
        "location": "Statewide - OKC & Tulsa",
        "city": "Oklahoma City",
        "bikeTypes": ["Sport Bikes", "Supersport", "All Motorcycles"],
        "contactInfo": "Find us on Facebook: Oklahoma Sportbike Association",
        "website": "https://www.facebook.com/groups/oklahomasportbike",
        "facebookGroup": "Oklahoma Sportbike Association",
        "meetingSchedule": "Monthly meetings, weekly rides",
        "focus": "Sport Riding, Advocacy, Events",
        "memberCount": "8,000+",
        "photos": [CLUB_IMAGES[2], CLUB_IMAGES[0]],
        "isApproved": True
    },
    {
        "name": "Green Country Sport Bikes",
        "description": "Covering the Tulsa to OKC corridor for sport bike riders. We organize dyno meets, group buys for parts, and safety-focused rides. All sport bike makes and models welcome!",
        "location": "Tulsa to OKC Corridor",
        "city": "Tulsa",
        "bikeTypes": ["Sport Bikes", "Supersport"],
        "contactInfo": "Find us on Facebook: Green Country Sport Bikes",
        "facebookGroup": "Green Country Sport Bikes",
        "meetingSchedule": "Regular rides and dyno days",
        "focus": "Sport Riding, Performance",
        "memberCount": "4,000+",
        "photos": [CLUB_IMAGES[0], CLUB_IMAGES[6]],
        "isApproved": True
    },
    {
        "name": "OKC Supersport Riders",
        "description": "High-performance sport bike enthusiasts in Oklahoma City. We focus on canyon carving in the Wichita Mountains and spirited street rides. For serious sport bike riders!",
        "location": "Oklahoma City, OK",
        "city": "Oklahoma City",
        "bikeTypes": ["Supersport", "Liter Bikes", "Sport Bikes"],
        "contactInfo": "Find us on Facebook: OKC Supersport Riders",
        "facebookGroup": "OKC Supersport Riders",
        "meetingSchedule": "Weekend canyon runs",
        "focus": "Performance Riding, Canyon Carving",
        "memberCount": "2,000+",
        "photos": [CLUB_IMAGES[2], CLUB_IMAGES[3]],
        "isApproved": True
    },
    {
        "name": "Oklahoma Crotch Rockets & Supersports",
        "description": "Pure sport bike focus for all of Oklahoma! Heavy OKC and Tulsa presence with live ride GPS shares, crash avoidance tips, and group rides. All supersport and sport bike riders welcome!",
        "location": "Statewide",
        "city": "Oklahoma City",
        "bikeTypes": ["Crotch Rockets", "Supersport", "Sport Bikes"],
        "contactInfo": "Find us on Facebook",
        "facebookGroup": "Oklahoma Crotch Rockets & Supersports",
        "meetingSchedule": "Multiple rides weekly",
        "focus": "Sport Riding, Safety",
        "memberCount": "6,000+",
        "photos": [CLUB_IMAGES[0], CLUB_IMAGES[4]],
        "isApproved": True
    },

    # ==================== HOG CHAPTERS (Harley Owners Group) ====================
    {
        "name": "Storm Riders HOG",
        "description": "A family-like community of Harley-Davidson enthusiasts based at Fort Thunder Harley-Davidson in Moore. We emphasize shared rides, events, and the bonds of brotherhood. All Harley riders welcome!",
        "location": "Fort Thunder Harley-Davidson, 500 SW 11th St, Moore, OK",
        "city": "Moore",
        "bikeTypes": ["Harley-Davidson", "Cruiser", "Touring"],
        "contactInfo": "Fort Thunder Harley-Davidson: (405) 759-0096",
        "website": "https://stormridersok.com",
        "meetingSchedule": "Monthly chapter meetings, weekly rides",
        "focus": "Harley-Davidson, Brotherhood, Charity",
        "memberCount": "500+",
        "photos": [CLUB_IMAGES[5], CLUB_IMAGES[7]],
        "isApproved": True
    },
    {
        "name": "Oklahoma City HOG",
        "description": "The official Harley Owners Group chapter for Oklahoma City and Edmond area. Casual riding group for Harley owners with monthly meetings and group rides throughout central Oklahoma.",
        "location": "Edmond/OKC Area",
        "city": "Edmond",
        "bikeTypes": ["Harley-Davidson", "Cruiser", "Touring"],
        "contactInfo": "Harley-Davidson World OKC",
        "website": "https://www.harleydavidsonworld.com",
        "meetingSchedule": "Monthly meetings at Harley-Davidson World",
        "focus": "Harley-Davidson, Community Rides",
        "memberCount": "400+",
        "photos": [CLUB_IMAGES[5], CLUB_IMAGES[6]],
        "isApproved": True
    },
    {
        "name": "Route 66 H.O.G.",
        "description": "Tulsa's premier Harley Owners Group chapter at Route 66 Harley-Davidson. Free local membership with national H.O.G. for recent Harley buyers. Open group rides and events year-round!",
        "location": "Route 66 Harley-Davidson, Tulsa, OK",
        "city": "Tulsa",
        "bikeTypes": ["Harley-Davidson", "Cruiser", "Touring"],
        "contactInfo": "Route 66 Harley-Davidson",
        "website": "https://route66h-d.com/hog",
        "meetingSchedule": "Monthly chapter meetings, weekly rides",
        "focus": "Harley-Davidson, Route 66 Heritage",
        "memberCount": "600+",
        "photos": [CLUB_IMAGES[5], CLUB_IMAGES[7]],
        "isApproved": True
    },
    {
        "name": "Diamondback H.O.G.",
        "description": "Lawton area's Harley Owners Group chapter at Diamondback Harley-Davidson. Family-friendly rides around Comanche County and the Wichita Mountains. All Harley riders welcome!",
        "location": "Diamondback Harley-Davidson, Lawton, OK",
        "city": "Lawton",
        "bikeTypes": ["Harley-Davidson", "Cruiser", "Touring"],
        "contactInfo": "Diamondback Harley-Davidson",
        "website": "https://www.diamondbackharley.com/About/HOG-Chapter",
        "meetingSchedule": "Monthly meetings, scenic mountain rides",
        "focus": "Harley-Davidson, Family Rides, Scenic Routes",
        "memberCount": "200+",
        "photos": [CLUB_IMAGES[5], CLUB_IMAGES[6]],
        "isApproved": True
    },

    # ==================== GENERAL RIDING CLUBS ====================
    {
        "name": "OKC Freedom Riders Central Chapter",
        "description": "Beginner-friendly motorcycle club founded in 2002. We focus on casual cruising, charity rides, and the open-road experience. Strong military and veteran interests. All bikes welcome!",
        "location": "Oklahoma City, OK",
        "city": "Oklahoma City",
        "bikeTypes": ["All Motorcycles", "Cruiser"],
        "contactInfo": "Find us on RiderClubs.com",
        "website": "https://www.riderclubs.com",
        "meetingSchedule": "Regular meetups and charity events",
        "focus": "Open Road, Charity, Veterans",
        "memberCount": "150+",
        "photos": [CLUB_IMAGES[4], CLUB_IMAGES[6]],
        "isApproved": True
    },
    {
        "name": "918 Riderz MC",
        "description": "Community-focused motorcycle club in the Tulsa area (918 area code). We enjoy casual cruising and open-road riding with a brotherhood atmosphere. All riders welcome!",
        "location": "Tulsa, OK",
        "city": "Tulsa",
        "bikeTypes": ["All Motorcycles", "Cruiser"],
        "contactInfo": "Find us on social media",
        "meetingSchedule": "Weekly rides and meetups",
        "focus": "Community, Brotherhood, Casual Riding",
        "memberCount": "100+",
        "photos": [CLUB_IMAGES[4], CLUB_IMAGES[7]],
        "isApproved": True
    },
    {
        "name": "Indian Motorcycle Riders Group - Chapter 1966",
        "description": "Open to all Indian motorcycle owners and enthusiasts! Monthly meetings and rides for Indian motorcycle riders in Oklahoma. Based at Indian Motorcycles of Oklahoma.",
        "location": "Oklahoma City, OK",
        "city": "Oklahoma City",
        "bikeTypes": ["Indian", "Cruiser", "Touring"],
        "contactInfo": "Indian Motorcycles of Oklahoma",
        "website": "https://www.indianmotorcyclesofoklahoma.com/check-out-the--indian-motorcycle-riders-group",
        "meetingSchedule": "Monthly meetings and rides",
        "focus": "Indian Motorcycles, Community",
        "memberCount": "200+",
        "photos": [CLUB_IMAGES[6], CLUB_IMAGES[5]],
        "isApproved": True
    },
    {
        "name": "American Veterans Motorcycle Club - Tulsa",
        "description": "Veteran-focused motorcycle group dedicated to the freedom of riding. Supporting our veterans while enjoying the open road together. All veterans and supporters welcome!",
        "location": "Tulsa, OK",
        "city": "Tulsa",
        "bikeTypes": ["All Motorcycles"],
        "contactInfo": "Find us on RiderClubs.com",
        "meetingSchedule": "Regular rides and veteran events",
        "focus": "Veterans, Brotherhood, Charity",
        "memberCount": "75+",
        "photos": [CLUB_IMAGES[4], CLUB_IMAGES[6]],
        "isApproved": True
    },
    {
        "name": "Blue Knights Oklahoma IV",
        "description": "Law enforcement motorcycle club for active and retired law enforcement officers. Brotherhood, charity rides, and supporting our communities through motorcycling.",
        "location": "Oklahoma City Area",
        "city": "Oklahoma City",
        "bikeTypes": ["All Motorcycles"],
        "contactInfo": "Contact through Blue Knights International",
        "meetingSchedule": "Monthly meetings",
        "focus": "Law Enforcement, Brotherhood, Charity",
        "memberCount": "50+",
        "photos": [CLUB_IMAGES[4], CLUB_IMAGES[6]],
        "isApproved": True
    },
    {
        "name": "Gold Wing Road Riders Association - Oklahoma Chapter E",
        "description": "For Honda Gold Wing touring enthusiasts! We focus on long-distance touring, casual cruising, and fellowship. If you love touring bikes, join us!",
        "location": "Tulsa Area",
        "city": "Tulsa",
        "bikeTypes": ["Honda Gold Wing", "Touring"],
        "contactInfo": "GWRRA Oklahoma",
        "website": "https://gwrra.org",
        "meetingSchedule": "Monthly meetings and touring rides",
        "focus": "Touring, Long Distance, Fellowship",
        "memberCount": "100+",
        "photos": [CLUB_IMAGES[6], CLUB_IMAGES[4]],
        "isApproved": True
    },
    {
        "name": "Tulsa Trail Riders",
        "description": "Off-road and dirt bike club promoting competition and racing in the Tulsa area. If you love getting dirty on two wheels, this is your crew!",
        "location": "Tulsa Area",
        "city": "Tulsa",
        "bikeTypes": ["Dirt Bikes", "Off-Road", "Dual Sport"],
        "contactInfo": "Find us on social media",
        "meetingSchedule": "Regular trail rides and competition events",
        "focus": "Off-Road, Racing, Competition",
        "memberCount": "200+",
        "photos": [CLUB_IMAGES[2], CLUB_IMAGES[4]],
        "isApproved": True
    },
    {
        "name": "Southern Cruisers Riding Club - Chapter 132",
        "description": "Family-oriented riding club promoting safe riding and fellowship across Oklahoma. All motorcycle makes and models welcome. No dues, no politics - just riding!",
        "location": "Oklahoma",
        "city": "Oklahoma City",
        "bikeTypes": ["All Motorcycles"],
        "contactInfo": "Southern Cruisers Riding Club",
        "website": "https://southerncruisers.net",
        "meetingSchedule": "Regular rides and family events",
        "focus": "Family, Safe Riding, Fellowship",
        "memberCount": "150+",
        "photos": [CLUB_IMAGES[4], CLUB_IMAGES[6]],
        "isApproved": True
    },
    {
        "name": "Midwest Sportbike Riders",
        "description": "Regional sport bike group covering Oklahoma, Kansas, and Arkansas. Join us for cross-state rides to Kansas' Flint Hills and Arkansas' scenic routes. OKC and Tulsa riders very active!",
        "location": "Oklahoma, Kansas, Arkansas",
        "city": "Oklahoma City",
        "bikeTypes": ["Sport Bikes", "Supersport"],
        "contactInfo": "Find us on Facebook: Midwest Sportbike Riders",
        "facebookGroup": "Midwest Sportbike Riders",
        "meetingSchedule": "Cross-state rides monthly",
        "focus": "Sport Riding, Regional Tours",
        "memberCount": "12,000+",
        "photos": [CLUB_IMAGES[0], CLUB_IMAGES[2]],
        "isApproved": True
    },
    {
        "name": "SurvivorsMC Tulsa Tribe",
        "description": "Brotherhood of clean and sober bikers emphasizing community support and casual cruising. If you're in recovery and love motorcycles, you've found your tribe!",
        "location": "Tulsa, OK",
        "city": "Tulsa",
        "bikeTypes": ["Cruiser", "All Motorcycles"],
        "contactInfo": "SurvivorsMC",
        "meetingSchedule": "Regular meetings and support rides",
        "focus": "Recovery, Brotherhood, Support",
        "memberCount": "50+",
        "photos": [CLUB_IMAGES[7], CLUB_IMAGES[4]],
        "isApproved": True
    },
]


async def seed_clubs():
    """Seed the database with motorcycle clubs"""
    mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client.test_database
    
    print("=" * 60)
    print("OKLAHOMA MOTORCYCLE CLUBS SEEDER")
    print("=" * 60)
    print(f"Connected to MongoDB")
    print(f"Found {len(SEED_CLUBS)} clubs to seed")
    print()
    
    # Count existing clubs
    existing_count = await db.clubs.count_documents({})
    print(f"Existing clubs in database: {existing_count}")
    print()
    
    inserted_count = 0
    skipped_count = 0
    
    for club in SEED_CLUBS:
        # Check if club already exists (by name)
        existing = await db.clubs.find_one({"name": club["name"]})
        
        if existing:
            print(f"⏭️  SKIP: {club['name']} (already exists)")
            skipped_count += 1
            continue
        
        # Add metadata
        club_doc = {
            **club,
            "source": "seed_script",
            "memberIds": [],
            "createdAt": datetime.utcnow().isoformat(),
            "updatedAt": datetime.utcnow().isoformat()
        }
        
        # Insert club
        await db.clubs.insert_one(club_doc)
        print(f"✅ ADD: {club['name']}")
        print(f"   📍 {club['city']} - {club['focus']}")
        inserted_count += 1
    
    # Final count
    final_count = await db.clubs.count_documents({})
    
    print()
    print("=" * 60)
    print("SEED COMPLETE")
    print("=" * 60)
    print(f"Clubs inserted: {inserted_count}")
    print(f"Clubs skipped (duplicates): {skipped_count}")
    print(f"Total clubs in database: {final_count}")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(seed_clubs())
