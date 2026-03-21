#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime

# Use the correct backend URL from frontend .env
BASE_URL = "https://drive-okc.preview.emergentagent.com/api"

def test_event_photo_gallery_api():
    """Test Event Photo Gallery API endpoints for Oklahoma City Car Meets app"""
    
    print("🚗 Testing Event Photo Gallery API Endpoints")
    print("=" * 60)
    
    # Test data
    test_user_id = "67a123456789abcdef123456"  # Test user ID
    test_uploader_name = "Mike Johnson"
    test_photo_base64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    test_caption = "My 2024 Mustang GT at the Oklahoma City Car Meet"
    
    # Step 1: Get an event ID from existing events
    print("\n1️⃣ Getting event ID from existing events...")
    try:
        response = requests.get(f"{BASE_URL}/events", timeout=10)
        print(f"GET /api/events - Status: {response.status_code}")
        
        if response.status_code == 200:
            events = response.json()
            if events and len(events) > 0:
                event_id = events[0]["id"]
                event_title = events[0]["title"]
                print(f"✅ Using event: {event_title} (ID: {event_id})")
            else:
                print("❌ No events found in database")
                return False
        else:
            print(f"❌ Failed to get events: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error getting events: {str(e)}")
        return False
    
    # Step 2: Test get event gallery (should be empty initially)
    print(f"\n2️⃣ Testing GET /api/events/{event_id}/gallery...")
    try:
        response = requests.get(f"{BASE_URL}/events/{event_id}/gallery", timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            gallery = response.json()
            print(f"✅ Gallery retrieved successfully")
            print(f"   Event: {gallery.get('eventTitle', 'N/A')}")
            print(f"   Photo count: {gallery.get('photoCount', 0)}")
            print(f"   Photos: {len(gallery.get('photos', []))}")
        else:
            print(f"❌ Failed to get gallery: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error getting gallery: {str(e)}")
        return False
    
    # Step 3: Test upload photo to gallery
    print(f"\n3️⃣ Testing POST /api/events/{event_id}/gallery/upload...")
    upload_data = {
        "eventId": event_id,
        "uploaderId": test_user_id,
        "uploaderName": test_uploader_name,
        "photo": test_photo_base64,
        "caption": test_caption
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/events/{event_id}/gallery/upload",
            json=upload_data,
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            uploaded_photo = response.json()
            photo_id = uploaded_photo["id"]
            print(f"✅ Photo uploaded successfully")
            print(f"   Photo ID: {photo_id}")
            print(f"   Uploader: {uploaded_photo.get('uploaderName', 'N/A')}")
            print(f"   Caption: {uploaded_photo.get('caption', 'N/A')}")
            print(f"   Like count: {uploaded_photo.get('likeCount', 0)}")
        else:
            print(f"❌ Failed to upload photo: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error uploading photo: {str(e)}")
        return False
    
    # Step 4: Create a test user car for tagging
    print(f"\n4️⃣ Creating test user car for tagging...")
    car_data = {
        "userId": test_user_id,
        "make": "Ford",
        "model": "Mustang GT",
        "year": "2024",
        "color": "Race Red",
        "modifications": [
            {
                "category": "Engine",
                "name": "Cold air intake",
                "brand": "K&N",
                "description": "High-flow air intake system",
                "cost": 350.0
            },
            {
                "category": "Exhaust",
                "name": "Cat-back exhaust",
                "brand": "Borla",
                "description": "ATAK cat-back exhaust system",
                "cost": 1200.0
            }
        ],
        "description": "My weekend warrior",
        "photos": [],
        "isPublic": True
    }
    
    try:
        response = requests.post(f"{BASE_URL}/user-cars", json=car_data, timeout=10)
        print(f"POST /api/user-cars - Status: {response.status_code}")
        
        if response.status_code == 200:
            created_car = response.json()
            car_id = created_car["id"]
            print(f"✅ Test car created successfully")
            print(f"   Car ID: {car_id}")
            print(f"   Car: {created_car.get('year')} {created_car.get('make')} {created_car.get('model')}")
        else:
            print(f"❌ Failed to create test car: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating test car: {str(e)}")
        return False
    
    # Step 5: Test tag car in photo
    print(f"\n5️⃣ Testing POST /api/events/{event_id}/gallery/{photo_id}/tag...")
    tag_data = {
        "userId": test_user_id,
        "carId": car_id,
        "carInfo": "2024 Ford Mustang GT"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/events/{event_id}/gallery/{photo_id}/tag",
            json=tag_data,
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            tagged_photo = response.json()
            print(f"✅ Car tagged in photo successfully")
            print(f"   Tags count: {len(tagged_photo.get('tags', []))}")
            if tagged_photo.get('tags'):
                tag = tagged_photo['tags'][0]
                print(f"   Tagged car: {tag.get('carInfo', 'N/A')}")
                print(f"   Tagged by user: {tag.get('userId', 'N/A')}")
        else:
            print(f"❌ Failed to tag car: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error tagging car: {str(e)}")
        return False
    
    # Step 6: Test get user tagged photos
    print(f"\n6️⃣ Testing GET /api/users/{test_user_id}/tagged-photos...")
    try:
        response = requests.get(f"{BASE_URL}/users/{test_user_id}/tagged-photos", timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            tagged_photos = response.json()
            print(f"✅ User tagged photos retrieved successfully")
            print(f"   Tagged photos count: {len(tagged_photos)}")
            if tagged_photos:
                photo = tagged_photos[0]
                print(f"   Event: {photo.get('eventTitle', 'N/A')}")
                print(f"   User tags: {len(photo.get('userTags', []))}")
        else:
            print(f"❌ Failed to get tagged photos: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error getting tagged photos: {str(e)}")
        return False
    
    # Step 7: Test like photo
    print(f"\n7️⃣ Testing POST /api/events/{event_id}/gallery/{photo_id}/like...")
    try:
        response = requests.post(
            f"{BASE_URL}/events/{event_id}/gallery/{photo_id}/like?user_id={test_user_id}",
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            like_result = response.json()
            print(f"✅ Photo like/unlike successful")
            print(f"   Liked: {like_result.get('liked', False)}")
            print(f"   Like count: {like_result.get('likeCount', 0)}")
        else:
            print(f"❌ Failed to like photo: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error liking photo: {str(e)}")
        return False
    
    # Step 8: Test like photo again (should unlike)
    print(f"\n8️⃣ Testing POST /api/events/{event_id}/gallery/{photo_id}/like (unlike)...")
    try:
        response = requests.post(
            f"{BASE_URL}/events/{event_id}/gallery/{photo_id}/like?user_id={test_user_id}",
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            like_result = response.json()
            print(f"✅ Photo unlike successful")
            print(f"   Liked: {like_result.get('liked', False)}")
            print(f"   Like count: {like_result.get('likeCount', 0)}")
        else:
            print(f"❌ Failed to unlike photo: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error unliking photo: {str(e)}")
        return False
    
    # Step 9: Test delete photo
    print(f"\n9️⃣ Testing DELETE /api/events/{event_id}/gallery/{photo_id}...")
    try:
        response = requests.delete(
            f"{BASE_URL}/events/{event_id}/gallery/{photo_id}?user_id={test_user_id}",
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            delete_result = response.json()
            print(f"✅ Photo deleted successfully")
            print(f"   Message: {delete_result.get('message', 'N/A')}")
        else:
            print(f"❌ Failed to delete photo: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error deleting photo: {str(e)}")
        return False
    
    # Step 10: Verify photo is deleted by checking gallery again
    print(f"\n🔟 Verifying photo deletion...")
    try:
        response = requests.get(f"{BASE_URL}/events/{event_id}/gallery", timeout=10)
        print(f"GET /api/events/{event_id}/gallery - Status: {response.status_code}")
        
        if response.status_code == 200:
            gallery = response.json()
            print(f"✅ Gallery verified after deletion")
            print(f"   Photo count: {gallery.get('photoCount', 0)}")
            
            # Check if our photo is gone
            photo_found = False
            for photo in gallery.get('photos', []):
                if photo.get('id') == photo_id:
                    photo_found = True
                    break
            
            if not photo_found:
                print(f"✅ Photo successfully removed from gallery")
            else:
                print(f"❌ Photo still exists in gallery")
                return False
        else:
            print(f"❌ Failed to verify gallery: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error verifying gallery: {str(e)}")
        return False
    
    # Test error cases
    print(f"\n🔧 Testing error cases...")
    
    # Test invalid event ID
    print(f"\n   Testing invalid event ID...")
    try:
        response = requests.get(f"{BASE_URL}/events/invalid_id/gallery", timeout=10)
        if response.status_code == 400:
            print(f"✅ Invalid event ID properly rejected (400)")
        else:
            print(f"❌ Invalid event ID not handled properly: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing invalid event ID: {str(e)}")
    
    # Test non-existent event
    print(f"\n   Testing non-existent event...")
    try:
        fake_event_id = "67a123456789abcdef999999"
        response = requests.get(f"{BASE_URL}/events/{fake_event_id}/gallery", timeout=10)
        if response.status_code == 404:
            print(f"✅ Non-existent event properly rejected (404)")
        else:
            print(f"❌ Non-existent event not handled properly: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing non-existent event: {str(e)}")
    
    print(f"\n🎉 Event Photo Gallery API testing completed successfully!")
    return True

def test_error_handling():
    """Test error handling for Event Photo Gallery API"""
    print(f"\n🔧 Testing Error Handling...")
    
    # Test invalid ObjectIds
    invalid_ids = ["invalid", "123", ""]
    
    for invalid_id in invalid_ids:
        try:
            response = requests.get(f"{BASE_URL}/events/{invalid_id}/gallery", timeout=5)
            if response.status_code == 400:
                print(f"✅ Invalid ID '{invalid_id}' properly rejected")
            else:
                print(f"❌ Invalid ID '{invalid_id}' not handled: {response.status_code}")
        except Exception as e:
            print(f"❌ Error testing invalid ID '{invalid_id}': {str(e)}")

if __name__ == "__main__":
    print("🚗 Oklahoma City Car Meets - Event Photo Gallery API Testing")
    print("=" * 70)
    
    success = test_event_photo_gallery_api()
    test_error_handling()
    
    if success:
        print(f"\n✅ All Event Photo Gallery API tests completed successfully!")
        sys.exit(0)
    else:
        print(f"\n❌ Some Event Photo Gallery API tests failed!")
        sys.exit(1)