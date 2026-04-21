"""
Facebook Event Importer for Oklahoma Bike Meets

This script parses scraped Facebook groups data to extract motorcycle events
and imports them into the database with event flyer images.
"""

import asyncio
import json
import os
import sys
import httpx
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

# Events extracted from Facebook groups scrape
FACEBOOK_EVENTS = [
    {
        "title": "Penny's Poker Run",
        "description": "Join us for this exciting poker run! We will have raffles and auction items that day! All vehicles welcome including cages and bikes. Let's make this a success with a great turnout!",
        "date": "2025-04-25",  # Saturday, April 25th
        "time": "TBD",
        "location": "The Pour House (Start)",
        "address": "Oklahoma City area",
        "city": "Oklahoma City",
        "eventType": "Poker Run",
        "entryFee": "$20 per rider, $10 passenger",
        "organizer": "Penny",
        "website": "",
        "bikeTypes": ["All Motorcycles", "All Vehicles"],
        "photos": [
            "https://scontent.fhyw1-1.fna.fbcdn.net/v/t39.30808-6/674266831_1425925632617188_340277876665339020_n.jpg?stp=dst-jpg_p526x296_tt6&_nc_cat=101&ccb=1-7&_nc_sid=e06c5d&_nc_ohc=aD2t0HJlwncQ7kNvwG6M5pv&_nc_oc=AdrcFlsLkupL8W-IwNGFM98qR-DVwtphH0y__phfSN_PmlQx9bVXAplr_cQHOM3WY6M&_nc_zt=23&_nc_ht=scontent.fhyw1-1.fna&_nc_gid=UruvZbs_47aYr_qQCord-g&_nc_ss=7a389&oh=00_Af135ukeuUOsYux5Oyb1XxYSGy9GqfulaR1tcJbIxQJHPg&oe=69ED15FB"
        ],
        "stops": [
            "Start: The Pour House",
            "1st Stop: Blues",
            "2nd Stop: Montana Mining",
            "3rd Stop: K Bar",
            "4th Stop: Pasttime"
        ],
        "source": "facebook_scrape",
        "isApproved": True
    },
    {
        "title": "Viet Nam Vets Legacy Vets MC - Welcome Back to OKC Party",
        "description": "Come welcome the Viet Nam Vets Legacy Vets MC back into Oklahoma City! Win prizes and 50/50 raffles. Listen to good music and have a blast with fellow riders.",
        "date": "2025-05-16",  # MAY 16
        "time": "TBD",
        "location": "Margarita Island",
        "address": "8139 NW 10th St, Oklahoma City, OK 73127",
        "city": "Oklahoma City",
        "eventType": "Motorcycle Rally",
        "entryFee": "TBD",
        "organizer": "Viet Nam Vets Legacy Vets MC",
        "contactInfo": "OK Mongo (405-919-6449), Roach (785-313-0413)",
        "website": "",
        "bikeTypes": ["All Motorcycles"],
        "photos": [
            "https://scontent-lga3-1.xx.fbcdn.net/v/t39.30808-6/674428350_10109160150567071_6757598871399269971_n.jpg?stp=dst-jpg_p526x296_tt6&_nc_cat=109&ccb=1-7&_nc_sid=e06c5d&_nc_ohc=gLiJF0XXBysQ7kNvwGuqt1g&_nc_oc=AdoqSjm8W6c3KmJgZpi6Nx6q_F76kOZq7wEwDhtIyoeN1f-O8m8kpngDk1UdXfM6nBw&_nc_zt=23&_nc_ht=scontent-lga3-1.fna&_nc_gid=vmd2xvc21biujczDhgRDuw&_nc_ss=7a389&oh=00_Af0s6Krq8aTwqljTrROJuFux7yos6jRdNeC4wvlo5hpKwQ&oe=69ED1AC9"
        ],
        "source": "facebook_scrape",
        "isApproved": True
    }
]


async def import_facebook_events():
    """Import events from Facebook scrape into database"""
    mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client.test_database
    
    print("=" * 60)
    print("FACEBOOK EVENT IMPORTER")
    print("=" * 60)
    print(f"Connected to MongoDB")
    print(f"Found {len(FACEBOOK_EVENTS)} events from Facebook scrape")
    print()
    
    imported_count = 0
    skipped_count = 0
    
    for event in FACEBOOK_EVENTS:
        # Check if event already exists
        existing = await db.events.find_one({
            "title": event["title"],
            "date": event["date"]
        })
        
        if existing:
            print(f"⏭️  SKIP: {event['title']} (already exists)")
            skipped_count += 1
            continue
        
        # Add metadata
        event_doc = {
            **event,
            "attendeeCount": 0,
            "createdAt": datetime.utcnow().isoformat(),
            "discoveredAt": datetime.utcnow().isoformat()
        }
        
        # Insert event
        result = await db.events.insert_one(event_doc)
        print(f"✅ ADDED: {event['title']}")
        print(f"   📅 Date: {event['date']}")
        print(f"   📍 Location: {event['location']}")
        if event.get('photos'):
            print(f"   🖼️  Has flyer image: Yes")
        imported_count += 1
    
    # Final count
    total_events = await db.events.count_documents({})
    
    print()
    print("=" * 60)
    print("IMPORT COMPLETE")
    print("=" * 60)
    print(f"Events imported: {imported_count}")
    print(f"Events skipped (duplicates): {skipped_count}")
    print(f"Total events in database: {total_events}")
    
    client.close()


async def parse_facebook_json(json_path: str):
    """
    Parse a Facebook groups scraper JSON file and extract events.
    This is a template for processing future scrapes.
    """
    import re
    
    with open(json_path, 'r') as f:
        data = json.load(f)
    
    events = []
    
    # Event keywords to look for
    event_keywords = [
        'poker run', 'rally', 'bike night', 'ride', 'event', 
        'party', 'meet', 'show', 'charity', 'benefit'
    ]
    
    # Date patterns
    date_patterns = [
        r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4}?',
        r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}',
        r'\d{1,2}/\d{1,2}/\d{2,4}',
        r'(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday),?\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}'
    ]
    
    for post in data:
        text = post.get('text', '').lower()
        
        # Check if this is an event post
        is_event = any(keyword in text for keyword in event_keywords)
        
        if is_event:
            # Extract image URLs
            photos = []
            attachments = post.get('attachments', [])
            for att in attachments:
                if att.get('thumbnail'):
                    photos.append(att['thumbnail'])
                if att.get('photo_image', {}).get('uri'):
                    photos.append(att['photo_image']['uri'])
            
            # Extract dates
            dates_found = []
            for pattern in date_patterns:
                matches = re.findall(pattern, post.get('text', ''), re.IGNORECASE)
                dates_found.extend(matches)
            
            event = {
                'raw_text': post.get('text', ''),
                'photos': photos,
                'dates_found': dates_found,
                'user': post.get('user', {}).get('name', 'Unknown'),
                'likes': post.get('likesCount', 0),
                'comments': post.get('commentsCount', 0)
            }
            events.append(event)
    
    return events


if __name__ == "__main__":
    asyncio.run(import_facebook_events())
