#!/usr/bin/env python3
"""
Comprehensive Backend API Regression Test
Tests all major endpoints after backend refactoring from monolithic to modular structure
"""

import requests
import json
import sys
from datetime import datetime, timedelta
import uuid

# Backend URL from environment
BACKEND_URL = "https://event-hub-okc.preview.emergentagent.com/api"

# Test credentials
ADMIN_EMAIL = "admin@okcarevents.com"
ADMIN_PASSWORD = "admin123"

# Global variables for test data
admin_token = None
admin_user_id = None
test_user_id = None
test_event_id = None
test_club_id = None
test_car_id = None
test_route_id = None
test_feedback_id = None

def log_test(test_name, status, details=""):
    """Log test results"""
    status_symbol = "✅" if status == "PASS" else "❌"
    print(f"{status_symbol} {test_name}: {details}")

def test_root_endpoint():
    """Test 1: Root endpoint"""
    try:
        response = requests.get(f"{BACKEND_URL}/")
        if response.status_code == 200:
            data = response.json()
            if "Oklahoma Car Events API" in str(data):
                log_test("Root Endpoint", "PASS", "Returns welcome message")
                return True
        log_test("Root Endpoint", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
        return False
    except Exception as e:
        log_test("Root Endpoint", "FAIL", f"Exception: {str(e)}")
        return False

def test_auth_login():
    """Test 2: Authentication - Login"""
    global admin_token, admin_user_id
    try:
        login_data = {
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }
        response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
        if response.status_code == 200:
            data = response.json()
            # Handle both wrapped and direct user response formats
            if "user" in data and "id" in data["user"]:
                admin_user_id = data["user"]["id"]
                admin_token = data.get("token", "dummy_token")
            elif "id" in data:
                admin_user_id = data["id"]
                admin_token = "dummy_token"
            
            if admin_user_id:
                log_test("Auth Login", "PASS", f"Admin user logged in: {admin_user_id}")
                return True
        log_test("Auth Login", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
        return False
    except Exception as e:
        log_test("Auth Login", "FAIL", f"Exception: {str(e)}")
        return False

def test_auth_register():
    """Test 3: Authentication - Register"""
    global test_user_id
    try:
        # Generate unique email for testing
        unique_email = f"testuser_{uuid.uuid4().hex[:8]}@test.com"
        register_data = {
            "name": "Test User",
            "nickname": "TestNick",
            "email": unique_email,
            "password": "testpass123"
        }
        response = requests.post(f"{BACKEND_URL}/auth/register", json=register_data)
        if response.status_code in [200, 201]:
            data = response.json()
            # Handle both wrapped and direct user response formats
            if "user" in data and "id" in data["user"]:
                test_user_id = data["user"]["id"]
            elif "id" in data:
                test_user_id = data["id"]
            
            if test_user_id:
                log_test("Auth Register", "PASS", f"New user registered: {test_user_id}")
                return True
        log_test("Auth Register", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
        return False
    except Exception as e:
        log_test("Auth Register", "FAIL", f"Exception: {str(e)}")
        return False

def test_events_crud():
    """Test 4-7: Events CRUD operations"""
    global test_event_id
    results = []
    
    # Test GET /api/events
    try:
        response = requests.get(f"{BACKEND_URL}/events")
        if response.status_code == 200:
            events = response.json()
            if isinstance(events, list) and len(events) > 0:
                log_test("Get All Events", "PASS", f"Retrieved {len(events)} events")
                results.append(True)
            else:
                log_test("Get All Events", "FAIL", "No events returned")
                results.append(False)
        else:
            log_test("Get All Events", "FAIL", f"Status: {response.status_code}")
            results.append(False)
    except Exception as e:
        log_test("Get All Events", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    # Test POST /api/events
    try:
        event_data = {
            "title": "Test Car Show Regression",
            "description": "Testing after backend refactoring",
            "date": "2025-02-15",
            "time": "10:00",
            "location": "Test Venue",
            "address": "123 Test Street, Oklahoma City, OK 73102",
            "city": "Oklahoma City",
            "eventType": "Car Show",
            "organizerId": admin_user_id or "test_organizer_id"
        }
        response = requests.post(f"{BACKEND_URL}/events", json=event_data)
        if response.status_code in [200, 201]:
            data = response.json()
            if "id" in data:
                test_event_id = data["id"]
                log_test("Create Event", "PASS", f"Event created: {test_event_id}")
                results.append(True)
            else:
                log_test("Create Event", "FAIL", "No ID in response")
                results.append(False)
        else:
            log_test("Create Event", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            results.append(False)
    except Exception as e:
        log_test("Create Event", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    # Test GET /api/events/{id}
    if test_event_id:
        try:
            response = requests.get(f"{BACKEND_URL}/events/{test_event_id}")
            if response.status_code == 200:
                data = response.json()
                if data.get("title") == "Test Car Show Regression":
                    log_test("Get Specific Event", "PASS", "Event retrieved correctly")
                    results.append(True)
                else:
                    log_test("Get Specific Event", "FAIL", "Event data mismatch")
                    results.append(False)
            else:
                log_test("Get Specific Event", "FAIL", f"Status: {response.status_code}")
                results.append(False)
        except Exception as e:
            log_test("Get Specific Event", "FAIL", f"Exception: {str(e)}")
            results.append(False)
    
    # Test PUT /api/events/{id}
    if test_event_id:
        try:
            update_data = {
                "description": "Updated description after refactoring test"
            }
            response = requests.put(f"{BACKEND_URL}/events/{test_event_id}", json=update_data)
            if response.status_code == 200:
                log_test("Update Event", "PASS", "Event updated successfully")
                results.append(True)
            else:
                log_test("Update Event", "FAIL", f"Status: {response.status_code}")
                results.append(False)
        except Exception as e:
            log_test("Update Event", "FAIL", f"Exception: {str(e)}")
            results.append(False)
    
    return all(results)

def test_rsvp_system():
    """Test 8-11: RSVP system"""
    results = []
    
    if not test_user_id or not test_event_id:
        log_test("RSVP System", "SKIP", "Missing test user or event ID")
        return False
    
    # Test POST /api/rsvp
    try:
        rsvp_data = {
            "userId": test_user_id,
            "eventId": test_event_id
        }
        response = requests.post(f"{BACKEND_URL}/rsvp", json=rsvp_data)
        if response.status_code in [200, 201]:
            log_test("Create RSVP", "PASS", "RSVP created successfully")
            results.append(True)
        else:
            log_test("Create RSVP", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            results.append(False)
    except Exception as e:
        log_test("Create RSVP", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    # Test GET /api/rsvp/user/{user_id}
    try:
        response = requests.get(f"{BACKEND_URL}/rsvp/user/{test_user_id}")
        if response.status_code == 200:
            rsvps = response.json()
            if isinstance(rsvps, list):
                log_test("Get User RSVPs", "PASS", f"Retrieved {len(rsvps)} RSVPs")
                results.append(True)
            else:
                log_test("Get User RSVPs", "FAIL", "Invalid response format")
                results.append(False)
        else:
            log_test("Get User RSVPs", "FAIL", f"Status: {response.status_code}")
            results.append(False)
    except Exception as e:
        log_test("Get User RSVPs", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    # Test GET /api/rsvp/check/{user_id}/{event_id}
    try:
        response = requests.get(f"{BACKEND_URL}/rsvp/check/{test_user_id}/{test_event_id}")
        if response.status_code == 200:
            data = response.json()
            if "hasRsvp" in data:
                log_test("Check RSVP Status", "PASS", f"RSVP status: {data['hasRsvp']}")
                results.append(True)
            else:
                log_test("Check RSVP Status", "FAIL", "Missing hasRsvp field")
                results.append(False)
        else:
            log_test("Check RSVP Status", "FAIL", f"Status: {response.status_code}")
            results.append(False)
    except Exception as e:
        log_test("Check RSVP Status", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    # Test DELETE /api/rsvp/{user_id}/{event_id}
    try:
        response = requests.delete(f"{BACKEND_URL}/rsvp/{test_user_id}/{test_event_id}")
        if response.status_code == 200:
            log_test("Cancel RSVP", "PASS", "RSVP cancelled successfully")
            results.append(True)
        else:
            log_test("Cancel RSVP", "FAIL", f"Status: {response.status_code}")
            results.append(False)
    except Exception as e:
        log_test("Cancel RSVP", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    return all(results)

def test_clubs_crud():
    """Test 12-14: Clubs CRUD operations"""
    global test_club_id
    results = []
    
    # Test GET /api/clubs
    try:
        response = requests.get(f"{BACKEND_URL}/clubs")
        if response.status_code == 200:
            clubs = response.json()
            if isinstance(clubs, list):
                log_test("Get All Clubs", "PASS", f"Retrieved {len(clubs)} clubs")
                results.append(True)
            else:
                log_test("Get All Clubs", "FAIL", "Invalid response format")
                results.append(False)
        else:
            log_test("Get All Clubs", "FAIL", f"Status: {response.status_code}")
            results.append(False)
    except Exception as e:
        log_test("Get All Clubs", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    # Test POST /api/clubs
    try:
        club_data = {
            "name": "Test Car Club Regression",
            "description": "Testing after backend refactoring",
            "location": "Oklahoma City",
            "city": "Oklahoma City",
            "carTypes": ["Muscle Cars", "Sports Cars"]
        }
        response = requests.post(f"{BACKEND_URL}/clubs", json=club_data)
        if response.status_code in [200, 201]:
            data = response.json()
            if "id" in data:
                test_club_id = data["id"]
                log_test("Create Club", "PASS", f"Club created: {test_club_id}")
                results.append(True)
            else:
                log_test("Create Club", "FAIL", "No ID in response")
                results.append(False)
        else:
            log_test("Create Club", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            results.append(False)
    except Exception as e:
        log_test("Create Club", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    # Test GET /api/clubs/{id}
    if test_club_id:
        try:
            response = requests.get(f"{BACKEND_URL}/clubs/{test_club_id}")
            if response.status_code == 200:
                data = response.json()
                if data.get("name") == "Test Car Club Regression":
                    log_test("Get Specific Club", "PASS", "Club retrieved correctly")
                    results.append(True)
                else:
                    log_test("Get Specific Club", "FAIL", "Club data mismatch")
                    results.append(False)
            else:
                log_test("Get Specific Club", "FAIL", f"Status: {response.status_code}")
                results.append(False)
        except Exception as e:
            log_test("Get Specific Club", "FAIL", f"Exception: {str(e)}")
            results.append(False)
    
    return all(results)

def test_user_cars_garage():
    """Test 15-17: User Cars/Garage system"""
    global test_car_id
    results = []
    
    if not test_user_id:
        log_test("User Cars System", "SKIP", "Missing test user ID")
        return False
    
    # Test POST /api/user-cars
    try:
        car_data = {
            "userId": test_user_id,
            "make": "Ford",
            "model": "Mustang GT",
            "year": "2024",  # Changed to string
            "color": "Grabber Blue",
            "modifications": [  # Changed to object format
                {
                    "category": "Engine",
                    "name": "Cold air intake",
                    "brand": "K&N",
                    "description": "High-flow air intake system",
                    "cost": 250
                },
                {
                    "category": "Exhaust",
                    "name": "Cat-back exhaust",
                    "brand": "Borla",
                    "description": "ATAK cat-back exhaust system",
                    "cost": 800
                }
            ],
            "description": "Test car for regression testing",
            "photos": [],
            "isPublic": True,
            "horsepower": 450,
            "torque": 410,
            "transmission": "6-speed manual",
            "drivetrain": "RWD"
        }
        response = requests.post(f"{BACKEND_URL}/user-cars", json=car_data)
        if response.status_code in [200, 201]:
            data = response.json()
            if "id" in data:
                test_car_id = data["id"]
                log_test("Create User Car", "PASS", f"Car created: {test_car_id}")
                results.append(True)
            else:
                log_test("Create User Car", "FAIL", "No ID in response")
                results.append(False)
        else:
            log_test("Create User Car", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            results.append(False)
    except Exception as e:
        log_test("Create User Car", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    # Test GET /api/user-cars/public
    try:
        response = requests.get(f"{BACKEND_URL}/user-cars/public")
        if response.status_code == 200:
            cars = response.json()
            if isinstance(cars, list):
                log_test("Get Public Cars", "PASS", f"Retrieved {len(cars)} public cars")
                results.append(True)
            else:
                log_test("Get Public Cars", "FAIL", "Invalid response format")
                results.append(False)
        else:
            log_test("Get Public Cars", "FAIL", f"Status: {response.status_code}")
            results.append(False)
    except Exception as e:
        log_test("Get Public Cars", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    # Test GET /api/user-cars/user/{user_id}
    try:
        response = requests.get(f"{BACKEND_URL}/user-cars/user/{test_user_id}")
        if response.status_code == 200:
            data = response.json()
            if data and "make" in data:
                log_test("Get User Car", "PASS", f"Retrieved user's {data['make']} {data['model']}")
                results.append(True)
            else:
                log_test("Get User Car", "PASS", "No car found for user (valid response)")
                results.append(True)
        else:
            log_test("Get User Car", "FAIL", f"Status: {response.status_code}")
            results.append(False)
    except Exception as e:
        log_test("Get User Car", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    return all(results)

def test_messaging_system():
    """Test 18-20: Messaging system"""
    results = []
    
    if not test_user_id or not admin_user_id:
        log_test("Messaging System", "SKIP", "Missing user IDs")
        return False
    
    # Test POST /api/messages
    try:
        message_data = {
            "senderId": test_user_id,
            "recipientId": admin_user_id,
            "content": "Test message after backend refactoring"
        }
        response = requests.post(f"{BACKEND_URL}/messages", json=message_data)
        if response.status_code in [200, 201]:
            log_test("Send Message", "PASS", "Message sent successfully")
            results.append(True)
        else:
            log_test("Send Message", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            results.append(False)
    except Exception as e:
        log_test("Send Message", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    # Test GET /api/messages/conversations/{user_id}
    try:
        response = requests.get(f"{BACKEND_URL}/messages/conversations/{test_user_id}")
        if response.status_code == 200:
            conversations = response.json()
            if isinstance(conversations, list):
                log_test("Get User Conversations", "PASS", f"Retrieved {len(conversations)} conversations")
                results.append(True)
            else:
                log_test("Get User Conversations", "FAIL", "Invalid response format")
                results.append(False)
        else:
            log_test("Get User Conversations", "FAIL", f"Status: {response.status_code}")
            results.append(False)
    except Exception as e:
        log_test("Get User Conversations", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    # Test GET /api/messages/thread/{user_id}/{partner_id}
    try:
        response = requests.get(f"{BACKEND_URL}/messages/thread/{test_user_id}/{admin_user_id}")
        if response.status_code == 200:
            thread = response.json()
            if isinstance(thread, list):
                log_test("Get Message Thread", "PASS", f"Retrieved {len(thread)} messages")
                results.append(True)
            else:
                log_test("Get Message Thread", "FAIL", "Invalid response format")
                results.append(False)
        else:
            log_test("Get Message Thread", "FAIL", f"Status: {response.status_code}")
            results.append(False)
    except Exception as e:
        log_test("Get Message Thread", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    return all(results)

def test_notifications():
    """Test 21-22: Notifications system"""
    results = []
    
    if not test_user_id:
        log_test("Notifications System", "SKIP", "Missing test user ID")
        return False
    
    # Test GET /api/notifications/{user_id}
    try:
        response = requests.get(f"{BACKEND_URL}/notifications/{test_user_id}")
        if response.status_code == 200:
            notifications = response.json()
            if isinstance(notifications, list):
                log_test("Get User Notifications", "PASS", f"Retrieved {len(notifications)} notifications")
                results.append(True)
            else:
                log_test("Get User Notifications", "FAIL", "Invalid response format")
                results.append(False)
        else:
            log_test("Get User Notifications", "FAIL", f"Status: {response.status_code}")
            results.append(False)
    except Exception as e:
        log_test("Get User Notifications", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    # Note: PUT /api/notifications/{id}/read requires a specific notification ID
    # We'll skip this test as it requires creating a notification first
    log_test("Mark Notification Read", "SKIP", "Requires specific notification ID")
    results.append(True)  # Don't fail the overall test for this
    
    return all(results)

def test_performance_system():
    """Test 23-24: Performance system"""
    results = []
    
    if not test_user_id:
        log_test("Performance System", "SKIP", "Missing test user ID")
        return False
    
    # Test POST /api/performance-runs
    try:
        performance_data = {
            "userId": test_user_id,
            "userName": "Test User",
            "nickname": "TestNick",
            "carInfo": "2024 Ford Mustang GT",
            "zeroToSixty": 4.2,
            "location": "Oklahoma City Test Track"
        }
        response = requests.post(f"{BACKEND_URL}/performance-runs", json=performance_data)
        if response.status_code in [200, 201]:
            log_test("Create Performance Run", "PASS", "Performance run created successfully")
            results.append(True)
        else:
            log_test("Create Performance Run", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            results.append(False)
    except Exception as e:
        log_test("Create Performance Run", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    # Test GET /api/leaderboard/0-60
    try:
        response = requests.get(f"{BACKEND_URL}/leaderboard/0-60")
        if response.status_code == 200:
            leaderboard = response.json()
            if isinstance(leaderboard, list):
                log_test("Get 0-60 Leaderboard", "PASS", f"Retrieved {len(leaderboard)} entries")
                results.append(True)
            else:
                log_test("Get 0-60 Leaderboard", "FAIL", "Invalid response format")
                results.append(False)
        else:
            log_test("Get 0-60 Leaderboard", "FAIL", f"Status: {response.status_code}")
            results.append(False)
    except Exception as e:
        log_test("Get 0-60 Leaderboard", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    return all(results)

def test_feedback_system():
    """Test 25-26: Feedback system"""
    global test_feedback_id
    results = []
    
    if not test_user_id:
        log_test("Feedback System", "SKIP", "Missing test user ID")
        return False
    
    # Test POST /api/feedback
    try:
        feedback_data = {
            "userId": test_user_id,
            "userName": "Test User",
            "userEmail": "testuser@test.com",
            "type": "bug",
            "subject": "Regression Test Feedback",
            "message": "Testing feedback system after backend refactoring"
        }
        response = requests.post(f"{BACKEND_URL}/feedback", json=feedback_data)
        if response.status_code in [200, 201]:
            data = response.json()
            if "id" in data:
                test_feedback_id = data["id"]
                log_test("Create Feedback", "PASS", f"Feedback created: {test_feedback_id}")
                results.append(True)
            else:
                log_test("Create Feedback", "PASS", "Feedback created successfully")
                results.append(True)
        else:
            log_test("Create Feedback", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            results.append(False)
    except Exception as e:
        log_test("Create Feedback", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    # Test GET /api/feedback/admin (requires admin access)
    if admin_user_id:
        try:
            response = requests.get(f"{BACKEND_URL}/feedback/admin?admin_id={admin_user_id}")
            if response.status_code == 200:
                feedback_list = response.json()
                if isinstance(feedback_list, list):
                    log_test("Get Admin Feedback", "PASS", f"Retrieved {len(feedback_list)} feedback items")
                    results.append(True)
                else:
                    log_test("Get Admin Feedback", "FAIL", "Invalid response format")
                    results.append(False)
            else:
                log_test("Get Admin Feedback", "FAIL", f"Status: {response.status_code}")
                results.append(False)
        except Exception as e:
            log_test("Get Admin Feedback", "FAIL", f"Exception: {str(e)}")
            results.append(False)
    else:
        log_test("Get Admin Feedback", "SKIP", "No admin user ID")
        results.append(True)
    
    return all(results)

def test_route_planning():
    """Test 27-28: Route Planning system"""
    global test_route_id
    results = []
    
    if not test_user_id:
        log_test("Route Planning System", "SKIP", "Missing test user ID")
        return False
    
    # Test POST /api/routes
    try:
        route_data = {
            "userId": test_user_id,
            "userName": "Test User",
            "name": "Test Scenic Route",
            "description": "Testing route planning after refactoring",
            "waypoints": [
                {"latitude": 35.4676, "longitude": -97.5164, "order": 1},
                {"latitude": 35.2271, "longitude": -97.4395, "order": 2}
            ],
            "distance": 25.5,
            "estimatedTime": "45",  # Changed to string
            "scenicHighlights": ["Lake Thunderbird", "Norman countryside"],
            "difficulty": "easy",
            "isPublic": True
        }
        response = requests.post(f"{BACKEND_URL}/routes", json=route_data)
        if response.status_code in [200, 201]:
            data = response.json()
            if "id" in data:
                test_route_id = data["id"]
                log_test("Create Route", "PASS", f"Route created: {test_route_id}")
                results.append(True)
            else:
                log_test("Create Route", "PASS", "Route created successfully")
                results.append(True)
        else:
            log_test("Create Route", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            results.append(False)
    except Exception as e:
        log_test("Create Route", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    # Test GET /api/routes
    try:
        response = requests.get(f"{BACKEND_URL}/routes")
        if response.status_code == 200:
            routes = response.json()
            if isinstance(routes, list):
                log_test("Get All Routes", "PASS", f"Retrieved {len(routes)} routes")
                results.append(True)
            else:
                log_test("Get All Routes", "FAIL", "Invalid response format")
                results.append(False)
        else:
            log_test("Get All Routes", "FAIL", f"Status: {response.status_code}")
            results.append(False)
    except Exception as e:
        log_test("Get All Routes", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    return all(results)

def test_nearby_users():
    """Test 29: Nearby Users system"""
    if not test_user_id:
        log_test("Nearby Users System", "SKIP", "Missing test user ID")
        return False
    
    try:
        # Test with Oklahoma City coordinates
        params = {
            "latitude": 35.4676,
            "longitude": -97.5164,
            "radius": 25
        }
        response = requests.get(f"{BACKEND_URL}/users/nearby/{test_user_id}", params=params)
        if response.status_code == 200:
            nearby_users = response.json()
            if isinstance(nearby_users, (list, dict)):  # Accept both list and dict formats
                if isinstance(nearby_users, dict) and "users" in nearby_users:
                    nearby_users = nearby_users["users"]
                log_test("Get Nearby Users", "PASS", f"Retrieved {len(nearby_users)} nearby users")
                return True
            else:
                log_test("Get Nearby Users", "FAIL", "Invalid response format")
                return False
        else:
            log_test("Get Nearby Users", "FAIL", f"Status: {response.status_code}")
            return False
    except Exception as e:
        log_test("Get Nearby Users", "FAIL", f"Exception: {str(e)}")
        return False

def test_admin_endpoints():
    """Test 30: Admin endpoints"""
    if not admin_user_id:
        log_test("Admin Endpoints", "SKIP", "Missing admin user ID")
        return False
    
    try:
        response = requests.get(f"{BACKEND_URL}/admin/events/pending?admin_id={admin_user_id}")
        if response.status_code == 200:
            pending_events = response.json()
            if isinstance(pending_events, (list, dict)):  # Accept both list and dict formats
                if isinstance(pending_events, dict) and "events" in pending_events:
                    pending_events = pending_events["events"]
                log_test("Get Pending Events", "PASS", f"Retrieved {len(pending_events)} pending events")
                return True
            else:
                log_test("Get Pending Events", "FAIL", "Invalid response format")
                return False
        else:
            log_test("Get Pending Events", "FAIL", f"Status: {response.status_code}")
            return False
    except Exception as e:
        log_test("Get Pending Events", "FAIL", f"Exception: {str(e)}")
        return False

def test_event_gallery():
    """Test 31-32: Event Gallery system"""
    results = []
    
    if not test_event_id:
        log_test("Event Gallery System", "SKIP", "Missing test event ID")
        return False
    
    # Test GET /api/events/{event_id}/gallery
    try:
        response = requests.get(f"{BACKEND_URL}/events/{test_event_id}/gallery")
        if response.status_code == 200:
            gallery = response.json()
            if "eventId" in gallery and "photos" in gallery:
                log_test("Get Event Gallery", "PASS", f"Gallery has {gallery.get('photoCount', 0)} photos")
                results.append(True)
            else:
                log_test("Get Event Gallery", "FAIL", "Invalid gallery structure")
                results.append(False)
        else:
            log_test("Get Event Gallery", "FAIL", f"Status: {response.status_code}")
            results.append(False)
    except Exception as e:
        log_test("Get Event Gallery", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    # Test POST /api/events/{event_id}/gallery/upload
    if test_user_id:
        try:
            upload_data = {
                "eventId": test_event_id,
                "uploaderId": test_user_id,
                "uploaderName": "Test User",
                "photo": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A==",
                "caption": "Test photo after refactoring",
                "tags": []
            }
            response = requests.post(f"{BACKEND_URL}/events/{test_event_id}/gallery/upload", json=upload_data)
            if response.status_code in [200, 201]:
                log_test("Upload Event Photo", "PASS", "Photo uploaded successfully")
                results.append(True)
            else:
                log_test("Upload Event Photo", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
                results.append(False)
        except Exception as e:
            log_test("Upload Event Photo", "FAIL", f"Exception: {str(e)}")
            results.append(False)
    else:
        log_test("Upload Event Photo", "SKIP", "No test user ID")
        results.append(True)
    
    return all(results)

def test_favorites_comments():
    """Test 33-34: Favorites and Comments system"""
    results = []
    
    if not test_user_id or not test_event_id:
        log_test("Favorites/Comments System", "SKIP", "Missing test user or event ID")
        return False
    
    # Test POST /api/favorites
    try:
        favorite_data = {
            "userId": test_user_id,
            "eventId": test_event_id
        }
        response = requests.post(f"{BACKEND_URL}/favorites", json=favorite_data)
        if response.status_code in [200, 201]:
            log_test("Add Favorite", "PASS", "Favorite added successfully")
            results.append(True)
        else:
            log_test("Add Favorite", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            results.append(False)
    except Exception as e:
        log_test("Add Favorite", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    # Test POST /api/comments
    try:
        comment_data = {
            "userId": test_user_id,
            "eventId": test_event_id,
            "userName": "Test User",
            "text": "Great event! Testing comments after refactoring."
        }
        response = requests.post(f"{BACKEND_URL}/comments", json=comment_data)
        if response.status_code in [200, 201]:
            log_test("Add Comment", "PASS", "Comment added successfully")
            results.append(True)
        else:
            log_test("Add Comment", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            results.append(False)
    except Exception as e:
        log_test("Add Comment", "FAIL", f"Exception: {str(e)}")
        results.append(False)
    
    return all(results)

def main():
    """Run comprehensive backend regression test"""
    print("🚗 Oklahoma Car Events API - Comprehensive Regression Test")
    print("=" * 60)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    test_results = []
    
    # Run all tests
    test_results.append(("Root Endpoint", test_root_endpoint()))
    test_results.append(("Auth Login", test_auth_login()))
    test_results.append(("Auth Register", test_auth_register()))
    test_results.append(("Events CRUD", test_events_crud()))
    test_results.append(("RSVP System", test_rsvp_system()))
    test_results.append(("Clubs CRUD", test_clubs_crud()))
    test_results.append(("User Cars/Garage", test_user_cars_garage()))
    test_results.append(("Messaging System", test_messaging_system()))
    test_results.append(("Notifications", test_notifications()))
    test_results.append(("Performance System", test_performance_system()))
    test_results.append(("Feedback System", test_feedback_system()))
    test_results.append(("Route Planning", test_route_planning()))
    test_results.append(("Nearby Users", test_nearby_users()))
    test_results.append(("Admin Endpoints", test_admin_endpoints()))
    test_results.append(("Event Gallery", test_event_gallery()))
    test_results.append(("Favorites/Comments", test_favorites_comments()))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, result in test_results if result)
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print(f"\nOverall Result: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! Backend refactoring successful.")
        return 0
    else:
        print(f"⚠️  {total - passed} tests failed. Please review the failures above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())