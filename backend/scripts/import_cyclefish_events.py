#!/usr/bin/env python3
"""
Import Oklahoma motorcycle events from CycleFish data
Checks for duplicates before inserting
"""

from pymongo import MongoClient
from datetime import datetime
import os
import re
from dotenv import load_dotenv

load_dotenv()

# CycleFish events data scraped from https://www.cyclefish.com/motorcycle_events/OKLAHOMA
CYCLEFISH_EVENTS = [
    {
        "title": "Thunder & Lightning in the Wichitas - OK CMA State Rally 2026",
        "date": "2026-04-23",
        "endDate": "2026-04-26",
        "city": "Medicine Park",
        "state": "OK",
        "eventType": "Motorcycle Rally",
        "description": "Oklahoma CMA State Rally in the scenic Wichita Mountains. A gathering of Christian motorcyclists for fellowship, worship, and riding.",
        "entryFee": "Contact organizer",
        "source": "CycleFish"
    },
    {
        "title": "GOAT X Rally 2026",
        "date": "2026-04-24",
        "endDate": "2026-04-26",
        "city": "Disney",
        "state": "OK",
        "eventType": "Motorcycle Rally",
        "description": "GOAT X Rally - an exciting motorcycle rally event in Disney, Oklahoma featuring live music, vendors, and great riding routes.",
        "entryFee": "Contact organizer",
        "source": "CycleFish"
    },
    {
        "title": "Watonga Bikes & BBQ Rally 2026",
        "date": "2026-04-24",
        "endDate": "2026-04-26",
        "city": "Watonga",
        "state": "OK",
        "eventType": "Motorcycle Rally",
        "description": "Bikes & BBQ Rally in Watonga - combining great motorcycle riding with delicious BBQ. Live music, vendors, and bike show.",
        "entryFee": "Contact organizer",
        "source": "CycleFish"
    },
    {
        "title": "LAMA Poker Run",
        "date": "2026-04-25",
        "city": "Oklahoma City",
        "state": "OK",
        "eventType": "Poker Run",
        "description": "LAMA Poker Run starting in Oklahoma City. Join fellow riders for a scenic poker run with prizes for best hands.",
        "entryFee": "Contact organizer",
        "source": "CycleFish"
    },
    {
        "title": "Motoplayground Roots Tour Round 4 Ponca City MX",
        "date": "2026-05-02",
        "endDate": "2026-05-03",
        "city": "Ponca City",
        "state": "OK",
        "eventType": "Motorcycle Race",
        "description": "Motoplayground Roots Tour Round 4 at Ponca City MX track. Motocross racing action featuring amateur and pro riders.",
        "entryFee": "Contact organizer",
        "source": "CycleFish"
    },
    {
        "title": "Harley-Davidson World Burnout at Shaffers Place",
        "date": "2026-05-02",
        "city": "Wellston",
        "state": "OK",
        "eventType": "Bike Show",
        "description": "Harley-Davidson World Burnout competition at Shaffers Place. Watch incredible burnout performances and motorcycle showcases.",
        "entryFee": "Contact organizer",
        "source": "CycleFish"
    },
    {
        "title": "Seaba Station Motorcycle Swap Meet",
        "date": "2026-05-02",
        "city": "Warwick",
        "state": "OK",
        "eventType": "Swap Meet",
        "description": "Motorcycle swap meet at historic Seaba Station on Route 66. Find parts, accessories, and vintage motorcycle treasures.",
        "entryFee": "Free admission",
        "source": "CycleFish"
    },
    {
        "title": "White Trash Bash Poker Run",
        "date": "2026-05-02",
        "city": "Enid",
        "state": "OK",
        "eventType": "Poker Run",
        "description": "White Trash Bash Poker Run - a fun charity poker run event starting in Enid. Proceeds benefit local charities.",
        "entryFee": "Contact organizer",
        "source": "CycleFish"
    },
    {
        "title": "Bikers Bible Retreat",
        "date": "2026-05-08",
        "endDate": "2026-05-10",
        "city": "Big Cedar",
        "state": "OK",
        "eventType": "Other",
        "description": "Bikers Bible Retreat at Big Cedar - a spiritual retreat for motorcycle enthusiasts featuring fellowship, worship, and scenic rides.",
        "entryFee": "Contact organizer",
        "source": "CycleFish"
    },
    {
        "title": "Iron Thunder 5-State Run",
        "date": "2026-05-09",
        "city": "Guymon",
        "state": "OK",
        "eventType": "Poker Run",
        "description": "Iron Thunder 5-State Run - an epic poker run that crosses through 5 states! Starting in Guymon, Oklahoma.",
        "entryFee": "Contact organizer",
        "source": "CycleFish"
    },
    {
        "title": "High Heels & Horsepower",
        "date": "2026-05-09",
        "city": "Oklahoma City",
        "state": "OK",
        "eventType": "Other",
        "description": "High Heels & Horsepower event in Oklahoma City - celebrating women riders and automotive enthusiasts.",
        "entryFee": "Contact organizer",
        "source": "CycleFish"
    },
    {
        "title": "Harley-Davidson x Smithsonian",
        "date": "2026-05-14",
        "endDate": "2026-05-17",
        "city": "Tulsa",
        "state": "OK",
        "eventType": "Bike Show",
        "description": "Harley-Davidson x Smithsonian exhibit in Tulsa - featuring motorcycle history, culture, and iconic bikes from the Smithsonian collection.",
        "entryFee": "Contact organizer",
        "source": "CycleFish"
    },
    {
        "title": "Motoplayground Roots Tour Round 5 Full Throttle MX",
        "date": "2026-05-16",
        "endDate": "2026-05-17",
        "city": "Okmulgee",
        "state": "OK",
        "eventType": "Motorcycle Race",
        "description": "Motoplayground Roots Tour Round 5 at Full Throttle MX in Okmulgee. Exciting motocross racing action.",
        "entryFee": "Contact organizer",
        "source": "CycleFish"
    },
    {
        "title": "5th Annual Marine Corps League Dice Run",
        "date": "2026-05-16",
        "city": "Lawton",
        "state": "OK",
        "eventType": "Poker Run",
        "description": "5th Annual Marine Corps League Dice Run in Lawton. Support our veterans while enjoying a great ride with fellow bikers.",
        "entryFee": "Contact organizer",
        "source": "CycleFish"
    },
    {
        "title": "14th Annual Special Care Ride for Kids",
        "date": "2026-05-16",
        "city": "Oklahoma City",
        "state": "OK",
        "eventType": "Poker Run",
        "description": "14th Annual Special Care Ride for Kids - a charity poker run benefiting children with special needs in Oklahoma City area.",
        "entryFee": "Contact organizer",
        "source": "CycleFish"
    },
    {
        "title": "BFC 5th Annual Poker Chip Run",
        "date": "2026-05-16",
        "city": "Claremore",
        "state": "OK",
        "eventType": "Poker Run",
        "description": "BFC 5th Annual Poker Chip Run starting in Claremore. Collect poker chips at stops for a chance to win prizes.",
        "entryFee": "Contact organizer",
        "source": "CycleFish"
    },
    {
        "title": "The 2026 Distinguished Gentleman's Ride - Oklahoma",
        "date": "2026-05-17",
        "city": "Various Cities",
        "state": "OK",
        "eventType": "Charity Ride",
        "description": "The Distinguished Gentleman's Ride - a global charity ride raising funds for men's health. Dress dapper, ride classic and vintage motorcycles.",
        "entryFee": "Fundraising required",
        "source": "CycleFish"
    },
    {
        "title": "Poncho Rides Again Poker Run",
        "date": "2026-05-22",
        "city": "Big Cedar",
        "state": "OK",
        "eventType": "Poker Run",
        "description": "Poncho Rides Again Poker Run at Big Cedar - a memorial poker run honoring a beloved rider with scenic routes.",
        "entryFee": "Contact organizer",
        "source": "CycleFish"
    },
    {
        "title": "Tail of the Dragon Tour",
        "date": "2026-05-22",
        "endDate": "2026-05-29",
        "city": "Tulsa",
        "state": "OK",
        "eventType": "Group Ride",
        "description": "Tail of the Dragon Tour departing from Tulsa - an epic week-long ride to the famous Tail of the Dragon and back.",
        "entryFee": "Contact organizer",
        "source": "CycleFish"
    },
    {
        "title": "Land, Air, Water Power Sports Expo 2026",
        "date": "2026-05-29",
        "endDate": "2026-05-30",
        "city": "Muskogee",
        "state": "OK",
        "eventType": "Bike Show",
        "description": "Land, Air, Water Power Sports Expo featuring motorcycles, ATVs, boats, and more. Vendors, demos, and family fun.",
        "entryFee": "Contact organizer",
        "source": "CycleFish"
    },
    {
        "title": "2nd Annual Orland Volunteer Fire Department Poker Run",
        "date": "2026-06-06",
        "city": "Orlando",
        "state": "OK",
        "eventType": "Poker Run",
        "description": "2nd Annual poker run benefiting the Orlando Volunteer Fire Department. Support your local firefighters!",
        "entryFee": "Contact organizer",
        "source": "CycleFish"
    },
    {
        "title": "Sparks Oklahoma Bike Week 2026",
        "date": "2026-06-15",
        "endDate": "2026-06-21",
        "city": "Sparks",
        "state": "OK",
        "eventType": "Motorcycle Rally",
        "description": "Sparks Oklahoma Bike Week - a week-long motorcycle rally featuring live music, vendors, bike shows, and great riding.",
        "entryFee": "Contact organizer",
        "source": "CycleFish"
    },
    {
        "title": "Villain Arts Tattoo Festival - Oklahoma City",
        "date": "2026-06-19",
        "endDate": "2026-06-21",
        "city": "Oklahoma City",
        "state": "OK",
        "eventType": "Other",
        "description": "Villain Arts Tattoo Festival in OKC - featuring world-class tattoo artists, live entertainment, and vendor marketplace.",
        "entryFee": "Contact organizer",
        "source": "CycleFish"
    },
    {
        "title": "Motoplayground Roots Tour Round 6 Game Moto",
        "date": "2026-06-20",
        "endDate": "2026-06-21",
        "city": "Tecumseh",
        "state": "OK",
        "eventType": "Motorcycle Race",
        "description": "Motoplayground Roots Tour Round 6 at Game Moto in Tecumseh. Motocross racing featuring amateur and pro classes.",
        "entryFee": "Contact organizer",
        "source": "CycleFish"
    },
    {
        "title": "10th Annual Ride to the Farm",
        "date": "2026-08-07",
        "endDate": "2026-08-09",
        "city": "Tahlequah",
        "state": "OK",
        "eventType": "Party",
        "description": "10th Annual Ride to the Farm - a multi-day motorcycle party in Tahlequah featuring camping, live music, and great riding.",
        "entryFee": "Contact organizer",
        "source": "CycleFish"
    },
    {
        "title": "Tulsa ABATE Motorcycle Drag Races",
        "date": "2026-08-15",
        "city": "Tulsa",
        "state": "OK",
        "eventType": "Motorcycle Race",
        "description": "Tulsa ABATE Motorcycle Drag Races - head-to-head motorcycle drag racing action. All bikes welcome to compete.",
        "entryFee": "Contact organizer",
        "source": "CycleFish"
    },
    {
        "title": "Labor Day Fest at Dall's Biker Camp",
        "date": "2026-09-04",
        "endDate": "2026-09-06",
        "city": "Big Cedar",
        "state": "OK",
        "eventType": "Motorcycle Rally",
        "description": "Labor Day Fest at Dall's Biker Camp in Big Cedar - celebrating the end of summer with live music, camping, and great riding.",
        "entryFee": "Contact organizer",
        "source": "CycleFish"
    },
    {
        "title": "Combat Veterans Motorcycle Association 13th Annual Bug Run",
        "date": "2026-09-26",
        "city": "Midwest City",
        "state": "OK",
        "eventType": "Poker Run",
        "description": "CVMA 13th Annual Bug Run - a poker run supporting combat veterans. Great riding and camaraderie with fellow riders.",
        "entryFee": "Contact organizer",
        "source": "CycleFish"
    },
    {
        "title": "Sparks Halloween Biker Bash 2026",
        "date": "2026-10-15",
        "endDate": "2026-10-18",
        "city": "Sparks",
        "state": "OK",
        "eventType": "Motorcycle Rally",
        "description": "Sparks Halloween Biker Bash - a spooky motorcycle rally with costume contests, live music, and Halloween festivities.",
        "entryFee": "Contact organizer",
        "source": "CycleFish"
    },
]

def normalize_title(title):
    """Normalize title for comparison - lowercase, remove special chars, extra spaces"""
    title = title.lower()
    title = re.sub(r'[^\w\s]', '', title)  # Remove special characters
    title = re.sub(r'\s+', ' ', title).strip()  # Normalize whitespace
    # Remove common suffixes/prefixes for better matching
    title = re.sub(r'\s*20\d{2}\s*', ' ', title)  # Remove years
    title = re.sub(r'\s*(rally|run|ride|meet|show|bash|fest|party)\s*$', '', title)
    return title.strip()

def is_duplicate(new_event, existing_events):
    """Check if event already exists based on title similarity and date"""
    new_title_norm = normalize_title(new_event['title'])
    new_date = new_event['date']
    
    for existing in existing_events:
        existing_title_norm = normalize_title(existing.get('title', ''))
        existing_date = existing.get('date', '')
        
        # Check for exact or very similar title match
        if new_title_norm == existing_title_norm:
            print(f"  DUPLICATE (exact match): '{new_event['title']}' matches '{existing['title']}'")
            return True
        
        # Check for partial match (one contains the other) with same date
        if new_date == existing_date:
            if new_title_norm in existing_title_norm or existing_title_norm in new_title_norm:
                print(f"  DUPLICATE (partial match): '{new_event['title']}' matches '{existing['title']}'")
                return True
            
            # Check for significant word overlap with same date
            new_words = set(new_title_norm.split())
            existing_words = set(existing_title_norm.split())
            common_words = new_words & existing_words
            # Remove common filler words
            common_words -= {'the', 'annual', 'rd', 'th', 'st', 'nd', 'at', 'in', 'of', 'and', 'a'}
            if len(common_words) >= 3:
                print(f"  DUPLICATE (word overlap): '{new_event['title']}' matches '{existing['title']}' ({common_words})")
                return True
    
    return False

def main():
    client = MongoClient(os.getenv('MONGO_URL', 'mongodb://localhost:27017'))
    db = client.test_database
    
    # Get existing events
    existing_events = list(db.events.find({}, {'title': 1, 'date': 1, 'city': 1}))
    print(f"Found {len(existing_events)} existing events in database")
    
    # Track stats
    added = 0
    skipped = 0
    
    print("\nProcessing CycleFish events...")
    print("=" * 60)
    
    for event in CYCLEFISH_EVENTS:
        if is_duplicate(event, existing_events):
            skipped += 1
            continue
        
        # Prepare event document
        event_doc = {
            "title": event['title'],
            "description": event['description'],
            "date": event['date'],
            "time": "TBA",
            "city": event['city'],
            "state": event.get('state', 'OK'),
            "location": f"{event['city']}, OK",
            "address": f"{event['city']}, OK",
            "eventType": event['eventType'],
            "entryFee": event.get('entryFee', 'Contact organizer'),
            "bikeTypes": ["All Bikes Welcome"],
            "amenities": [],
            "isApproved": True,
            "status": "approved",
            "source": "CycleFish",
            "createdAt": datetime.utcnow().isoformat(),
            "updatedAt": datetime.utcnow().isoformat(),
            "attendeeCount": 0,
            "rsvps": [],
            "photos": [],
        }
        
        # Add end date if multi-day event
        if 'endDate' in event:
            event_doc['endDate'] = event['endDate']
        
        # Insert the event
        result = db.events.insert_one(event_doc)
        print(f"  ADDED: {event['title']} ({event['date']}) - ID: {result.inserted_id}")
        added += 1
        
        # Add to existing list to prevent duplicates within batch
        existing_events.append({'title': event['title'], 'date': event['date'], 'city': event['city']})
    
    print("=" * 60)
    print(f"\nSUMMARY:")
    print(f"  Added: {added} new events")
    print(f"  Skipped: {skipped} duplicates")
    print(f"  Total events now: {db.events.count_documents({})}")

if __name__ == "__main__":
    main()
