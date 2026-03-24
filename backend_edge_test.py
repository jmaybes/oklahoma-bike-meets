#!/usr/bin/env python3
"""
Edge case and error handling tests for Oklahoma Car Events API
"""

import requests
import json

BASE_URL = "https://carfest-okc.preview.emergentagent.com/api"

def test_error_cases():
    """Test error handling and edge cases"""
    print("🔍 Testing Error Handling and Edge Cases")
    print("=" * 60)
    
    # Test invalid event ID
    print("Testing invalid event ID...")
    response = requests.get(f"{BASE_URL}/events/invalid_id")
    print(f"Invalid event ID: Status {response.status_code} - {'✅' if response.status_code == 400 else '❌'}")
    
    # Test non-existent event ID
    print("Testing non-existent event ID...")
    fake_id = "507f1f77bcf86cd799439011"  # Valid ObjectId format but doesn't exist
    response = requests.get(f"{BASE_URL}/events/{fake_id}")
    print(f"Non-existent event: Status {response.status_code} - {'✅' if response.status_code == 404 else '❌'}")
    
    # Test duplicate user registration
    print("Testing duplicate user registration...")
    user_data = {
        "email": "duplicate@test.com",
        "name": "Duplicate User",
        "password": "password123"
    }
    
    # Register first time
    response1 = requests.post(f"{BASE_URL}/auth/register", json=user_data)
    print(f"First registration: Status {response1.status_code} - {'✅' if response1.status_code == 200 else '❌'}")
    
    # Try to register again
    response2 = requests.post(f"{BASE_URL}/auth/register", json=user_data)
    print(f"Duplicate registration: Status {response2.status_code} - {'✅' if response2.status_code == 400 else '❌'}")
    
    # Test invalid login credentials
    print("Testing invalid login...")
    invalid_login = {
        "email": "nonexistent@test.com",
        "password": "wrongpassword"
    }
    response = requests.post(f"{BASE_URL}/auth/login", json=invalid_login)
    print(f"Invalid login: Status {response.status_code} - {'✅' if response.status_code == 401 else '❌'}")
    
    # Test malformed request data
    print("Testing malformed event creation...")
    malformed_event = {
        "title": "Test Event"
        # Missing required fields
    }
    response = requests.post(f"{BASE_URL}/events", json=malformed_event)
    print(f"Malformed event: Status {response.status_code} - {'✅' if response.status_code == 422 else '❌'}")
    
    # Test empty search
    print("Testing empty search...")
    response = requests.get(f"{BASE_URL}/events", params={"search": ""})
    print(f"Empty search: Status {response.status_code} - {'✅' if response.status_code == 200 else '❌'}")
    
    print("\n🔍 Edge Case Testing Complete")

def test_data_persistence():
    """Test that data persists correctly"""
    print("\n💾 Testing Data Persistence")
    print("=" * 40)
    
    # Create a user and event, then verify they persist
    user_data = {
        "email": "persistence@test.com",
        "name": "Persistence Test User",
        "password": "persist123"
    }
    
    user_response = requests.post(f"{BASE_URL}/auth/register", json=user_data)
    if user_response.status_code == 200:
        user_id = user_response.json().get('id')
        print(f"Created user: {user_id} - ✅")
        
        # Create an event
        event_data = {
            "title": "Persistence Test Event",
            "description": "Testing data persistence",
            "date": "2025-06-15",
            "time": "19:00",
            "location": "Test Location",
            "address": "123 Test St",
            "city": "Test City",
            "organizer": "Test Organizer"
        }
        
        event_response = requests.post(f"{BASE_URL}/events", json=event_data)
        if event_response.status_code == 200:
            event_id = event_response.json().get('id')
            print(f"Created event: {event_id} - ✅")
            
            # Verify event can be retrieved
            get_response = requests.get(f"{BASE_URL}/events/{event_id}")
            if get_response.status_code == 200:
                retrieved_event = get_response.json()
                if retrieved_event.get('title') == event_data['title']:
                    print("Event data persisted correctly - ✅")
                else:
                    print("Event data mismatch - ❌")
            
            # Test favorites persistence
            favorite_data = {"userId": user_id, "eventId": event_id}
            fav_response = requests.post(f"{BASE_URL}/favorites", json=favorite_data)
            if fav_response.status_code == 200:
                # Verify favorite persists
                fav_list = requests.get(f"{BASE_URL}/favorites/user/{user_id}")
                if fav_list.status_code == 200 and len(fav_list.json()) > 0:
                    print("Favorite persisted correctly - ✅")
                else:
                    print("Favorite persistence issue - ❌")
            
            # Cleanup - delete test event
            requests.delete(f"{BASE_URL}/events/{event_id}")
    
    print("💾 Data Persistence Testing Complete")

if __name__ == "__main__":
    test_error_cases()
    test_data_persistence()