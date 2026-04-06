"""
One-time script to regenerate all car thumbnails with higher quality settings.
Run: python3 regenerate_thumbnails.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv()

from helpers import make_thumbnail_base64

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

def regenerate_all():
    cars = list(db.user_cars.find({}, {"photos": 1, "make": 1, "model": 1, "year": 1, "mainPhotoIndex": 1}))
    print(f"Found {len(cars)} cars total")
    
    updated = 0
    skipped = 0
    failed = 0
    
    for car in cars:
        photos = car.get("photos", [])
        car_id = car["_id"]
        label = f"{car.get('year', '')} {car.get('make', '')} {car.get('model', '')}"
        
        if not photos:
            skipped += 1
            continue
        
        # Use mainPhotoIndex or first photo
        main_idx = car.get("mainPhotoIndex", 0)
        source_photo = photos[min(main_idx, len(photos) - 1)]
        
        if not source_photo or len(str(source_photo)) < 100:
            print(f"  SKIP {label} - photo data too small or empty")
            skipped += 1
            continue
        
        try:
            thumbnail = make_thumbnail_base64(source_photo)
            if thumbnail and len(thumbnail) > 100:
                # Get raw size for reporting
                raw = thumbnail.split(',', 1)[1] if ',' in thumbnail else thumbnail
                import base64
                thumb_bytes = base64.b64decode(raw)
                size_kb = len(thumb_bytes) / 1024
                
                db.user_cars.update_one(
                    {"_id": car_id},
                    {"$set": {
                        "thumbnail": thumbnail,
                        "photoCount": len(photos)
                    }}
                )
                updated += 1
                print(f"  OK {label} - {size_kb:.1f} KB")
            else:
                print(f"  FAIL {label} - thumbnail generation returned empty")
                failed += 1
        except Exception as e:
            print(f"  ERROR {label}: {e}")
            failed += 1
    
    print(f"\nDone! Updated: {updated}, Skipped: {skipped}, Failed: {failed}")

if __name__ == "__main__":
    regenerate_all()
