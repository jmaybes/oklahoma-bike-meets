from pymongo import MongoClient
from datetime import datetime
client = MongoClient('mongodb://localhost:27017')
db = client.test_database
events = [
    {"title": "Road House Saturday Bike Night", "description": "Saturday evening bike night in OKC with free food!", "date": "2026-04-25", "time": "6:30 PM", "city": "Oklahoma City", "state": "OK", "location": "Oklahoma City, OK", "eventType": "Bike Night", "entryFee": "Free", "bikeTypes": ["All Bikes"], "isApproved": True, "status": "approved", "createdAt": datetime.utcnow().isoformat()},
    {"title": "Thunder Rally 2026", "description": "CMA State Rally in Wichita Mountains.", "date": "2026-04-26", "time": "10:00 AM", "city": "Medicine Park", "state": "OK", "location": "Medicine Park, OK", "eventType": "Rally", "entryFee": "Free", "bikeTypes": ["All Bikes"], "isApproved": True, "status": "approved", "createdAt": datetime.utcnow().isoformat()},
    {"title": "Watonga Bikes & BBQ", "description": "Great riding with BBQ.", "date": "2026-04-27", "time": "11:00 AM", "city": "Watonga", "state": "OK", "location": "Watonga, OK", "eventType": "Rally", "entryFee": "$20", "bikeTypes": ["All Bikes"], "isApproved": True, "status": "approved", "createdAt": datetime.utcnow().isoformat()},
    {"title": "Tulsa Swap Meet", "description": "Parts and vintage bikes.", "date": "2026-05-02", "time": "9:00 AM", "city": "Tulsa", "state": "OK", "location": "Tulsa, OK", "eventType": "Swap Meet", "entryFee": "Free", "bikeTypes": ["All Bikes"], "isApproved": True, "status": "approved", "createdAt": datetime.utcnow().isoformat()},
    {"title": "Route 66 Bike Week", "description": "Week-long rally on Route 66.", "date": "2026-06-18", "time": "All Day", "city": "Depew", "state": "OK", "location": "Depew, OK", "eventType": "Rally", "entryFee": "$50", "bikeTypes": ["All Bikes"], "isApproved": True, "status": "approved", "createdAt": datetime.utcnow().isoformat()},
]
clubs = [
    {"name": "OKC Sport Bike Riders", "description": "Sport bike enthusiasts.", "city": "Oklahoma City", "state": "OK", "memberCount": 245, "bikeTypes": ["Sport Bikes"], "isApproved": True, "createdAt": datetime.utcnow().isoformat()},
    {"name": "Tulsa Cruiser Club", "description": "Cruiser and touring bikes.", "city": "Tulsa", "state": "OK", "memberCount": 180, "bikeTypes": ["Cruisers"], "isApproved": True, "createdAt": datetime.utcnow().isoformat()},
    {"name": "OKC HOG Chapter", "description": "Harley Owners Group.", "city": "Oklahoma City", "state": "OK", "memberCount": 320, "bikeTypes": ["Harley-Davidson"], "isApproved": True, "createdAt": datetime.utcnow().isoformat()},
]
db.events.insert_many(events)
db.clubs.insert_many(clubs)
print("Done! 5 events + 3 clubs added")
