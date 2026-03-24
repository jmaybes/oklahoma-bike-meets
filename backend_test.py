#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Oklahoma Car Events App
Testing all endpoints that haven't been tested yet based on test_result.md
"""

import requests
import json
import base64
from datetime import datetime, timedelta
import time

# Backend URL from frontend .env
BASE_URL = "https://cruise-tracker-2.preview.emergentagent.com/api"

# Admin credentials
ADMIN_EMAIL = "admin@okcarevents.com"
ADMIN_PASSWORD = "admin123"

# Test results storage
test_results = []

def log_test(endpoint, method, status, message, details=None):
    """Log test results"""
    result = {
        "endpoint": endpoint,
        "method": method,
        "status": "✅ PASS" if status else "❌ FAIL",
        "message": message,
        "details": details or {},
        "timestamp": datetime.now().isoformat()
    }
    test_results.append(result)
    print(f"{result['status']} {method} {endpoint}: {message}")
    if details:
        print(f"   Details: {details}")

def test_clubs_endpoints():
    """Test all Clubs endpoints"""
    print("\n=== TESTING CLUBS ENDPOINTS ===")
    
    # Test GET /api/clubs
    try:
        response = requests.get(f"{BASE_URL}/clubs")
        if response.status_code == 200:
            clubs = response.json()
            log_test("/clubs", "GET", True, f"Retrieved {len(clubs)} clubs", {"count": len(clubs)})
        else:
            log_test("/clubs", "GET", False, f"Status {response.status_code}", {"response": response.text})
    except Exception as e:
        log_test("/clubs", "GET", False, f"Exception: {str(e)}")

    # Test POST /api/clubs (Create club)
    try:
        club_data = {
            "name": "Test Car Club",
            "description": "A test car club for API testing",
            "location": "Oklahoma City, OK",
            "city": "Oklahoma City",
            "carTypes": ["Classic Cars", "Muscle Cars"]
        }
        response = requests.post(f"{BASE_URL}/clubs", json=club_data)
        if response.status_code in [200, 201]:
            club = response.json()
            club_id = club.get('id')
            log_test("/clubs", "POST", True, "Club created successfully", {"club_id": club_id})
            
            # Test GET /api/clubs/{club_id}
            if club_id:
                try:
                    response = requests.get(f"{BASE_URL}/clubs/{club_id}")
                    if response.status_code == 200:
                        log_test(f"/clubs/{club_id}", "GET", True, "Retrieved club by ID")
                    else:
                        log_test(f"/clubs/{club_id}", "GET", False, f"Status {response.status_code}")
                except Exception as e:
                    log_test(f"/clubs/{club_id}", "GET", False, f"Exception: {str(e)}")
                
                # Test PUT /api/clubs/{club_id}
                try:
                    update_data = {"description": "Updated test car club description"}
                    response = requests.put(f"{BASE_URL}/clubs/{club_id}", json=update_data)
                    if response.status_code == 200:
                        log_test(f"/clubs/{club_id}", "PUT", True, "Club updated successfully")
                    else:
                        log_test(f"/clubs/{club_id}", "PUT", False, f"Status {response.status_code}")
                except Exception as e:
                    log_test(f"/clubs/{club_id}", "PUT", False, f"Exception: {str(e)}")
                
                # Test DELETE /api/clubs/{club_id}
                try:
                    response = requests.delete(f"{BASE_URL}/clubs/{club_id}")
                    if response.status_code in [200, 204]:
                        log_test(f"/clubs/{club_id}", "DELETE", True, "Club deleted successfully")
                    else:
                        log_test(f"/clubs/{club_id}", "DELETE", False, f"Status {response.status_code}")
                except Exception as e:
                    log_test(f"/clubs/{club_id}", "DELETE", False, f"Exception: {str(e)}")
        else:
            log_test("/clubs", "POST", False, f"Status {response.status_code}", {"response": response.text})
    except Exception as e:
        log_test("/clubs", "POST", False, f"Exception: {str(e)}")

def test_route_planning_endpoints():
    """Test all Route Planning endpoints"""
    print("\n=== TESTING ROUTE PLANNING ENDPOINTS ===")
    
    # First, login to get user credentials
    try:
        login_response = requests.post(f"{BASE_URL}/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if login_response.status_code != 200:
            log_test("Route Planning", "SETUP", False, "Failed to login for route testing")
            return
        
        user_data = login_response.json()
        user_id = user_data.get('id')
        
        if not user_id:
            log_test("Route Planning", "SETUP", False, "No user ID in login response")
            return
            
    except Exception as e:
        log_test("Route Planning", "SETUP", False, f"Login exception: {str(e)}")
        return

    # Test POST /api/routes (Create route)
    try:
        route_data = {
            "userId": user_id,
            "userName": "Admin User",
            "name": "Test Scenic Route",
            "description": "A beautiful test route through Oklahoma",
            "waypoints": [
                {"latitude": 35.6528, "longitude": -97.4781, "name": "Edmond", "order": 1},
                {"latitude": 35.8784, "longitude": -97.4253, "name": "Guthrie", "order": 2}
            ],
            "distance": 106.2,
            "estimatedTime": "2h 0m",
            "scenicHighlights": ["Historic Route", "Scenic Views"],
            "difficulty": "easy",
            "isPublic": True
        }
        response = requests.post(f"{BASE_URL}/routes", json=route_data)
        if response.status_code in [200, 201]:
            route = response.json()
            route_id = route.get('id')
            log_test("/routes", "POST", True, "Route created successfully", {"route_id": route_id})
            
            # Test GET /api/routes/{route_id}
            if route_id:
                try:
                    response = requests.get(f"{BASE_URL}/routes/{route_id}")
                    if response.status_code == 200:
                        log_test(f"/routes/{route_id}", "GET", True, "Retrieved route by ID")
                    else:
                        log_test(f"/routes/{route_id}", "GET", False, f"Status {response.status_code}")
                except Exception as e:
                    log_test(f"/routes/{route_id}", "GET", False, f"Exception: {str(e)}")
                
                # Test PUT /api/routes/{route_id}
                try:
                    update_data = {"description": "Updated test route description"}
                    response = requests.put(f"{BASE_URL}/routes/{route_id}", json=update_data)
                    if response.status_code == 200:
                        log_test(f"/routes/{route_id}", "PUT", True, "Route updated successfully")
                    else:
                        log_test(f"/routes/{route_id}", "PUT", False, f"Status {response.status_code}")
                except Exception as e:
                    log_test(f"/routes/{route_id}", "PUT", False, f"Exception: {str(e)}")
                
                # Test POST /api/routes/{route_id}/like
                try:
                    response = requests.post(f"{BASE_URL}/routes/{route_id}/like", params={"user_id": user_id})
                    if response.status_code == 200:
                        log_test(f"/routes/{route_id}/like", "POST", True, "Route liked successfully")
                    else:
                        log_test(f"/routes/{route_id}/like", "POST", False, f"Status {response.status_code}")
                except Exception as e:
                    log_test(f"/routes/{route_id}/like", "POST", False, f"Exception: {str(e)}")
                
                # Test POST /api/routes/{route_id}/save
                try:
                    response = requests.post(f"{BASE_URL}/routes/{route_id}/save", params={"user_id": user_id})
                    if response.status_code == 200:
                        log_test(f"/routes/{route_id}/save", "POST", True, "Route saved successfully")
                    else:
                        log_test(f"/routes/{route_id}/save", "POST", False, f"Status {response.status_code}")
                except Exception as e:
                    log_test(f"/routes/{route_id}/save", "POST", False, f"Exception: {str(e)}")
                
                # Test DELETE /api/routes/{route_id}
                try:
                    response = requests.delete(f"{BASE_URL}/routes/{route_id}", params={"user_id": user_id})
                    if response.status_code in [200, 204]:
                        log_test(f"/routes/{route_id}", "DELETE", True, "Route deleted successfully")
                    else:
                        log_test(f"/routes/{route_id}", "DELETE", False, f"Status {response.status_code}")
                except Exception as e:
                    log_test(f"/routes/{route_id}", "DELETE", False, f"Exception: {str(e)}")
        else:
            log_test("/routes", "POST", False, f"Status {response.status_code}", {"response": response.text})
    except Exception as e:
        log_test("/routes", "POST", False, f"Exception: {str(e)}")

    # Test GET /api/routes (List all routes)
    try:
        response = requests.get(f"{BASE_URL}/routes")
        if response.status_code == 200:
            routes = response.json()
            log_test("/routes", "GET", True, f"Retrieved {len(routes)} routes", {"count": len(routes)})
        else:
            log_test("/routes", "GET", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("/routes", "GET", False, f"Exception: {str(e)}")

    # Test GET /api/routes/user/{user_id}
    try:
        response = requests.get(f"{BASE_URL}/routes/user/{user_id}")
        if response.status_code == 200:
            user_routes = response.json()
            log_test(f"/routes/user/{user_id}", "GET", True, f"Retrieved {len(user_routes)} user routes")
        else:
            log_test(f"/routes/user/{user_id}", "GET", False, f"Status {response.status_code}")
    except Exception as e:
        log_test(f"/routes/user/{user_id}", "GET", False, f"Exception: {str(e)}")

def test_nearby_users_endpoint():
    """Test Nearby Users endpoint"""
    print("\n=== TESTING NEARBY USERS ENDPOINT ===")
    
    # First, login to get user credentials
    try:
        login_response = requests.post(f"{BASE_URL}/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if login_response.status_code != 200:
            log_test("Nearby Users", "SETUP", False, "Failed to login")
            return
        
        user_data = login_response.json()
        user_id = user_data.get('id')
        
        if not user_id:
            log_test("Nearby Users", "SETUP", False, "No user ID in login response")
            return
            
    except Exception as e:
        log_test("Nearby Users", "SETUP", False, f"Login exception: {str(e)}")
        return

    # Test GET /api/users/nearby/{user_id}
    try:
        # Add required latitude and longitude parameters
        params = {
            "latitude": 35.4676,  # Oklahoma City coordinates
            "longitude": -97.5164
        }
        response = requests.get(f"{BASE_URL}/users/nearby/{user_id}", params=params)
        if response.status_code == 200:
            nearby_users = response.json()
            log_test(f"/users/nearby/{user_id}", "GET", True, f"Retrieved {len(nearby_users)} nearby users")
        else:
            log_test(f"/users/nearby/{user_id}", "GET", False, f"Status {response.status_code}", {"response": response.text})
    except Exception as e:
        log_test(f"/users/nearby/{user_id}", "GET", False, f"Exception: {str(e)}")

def test_ocr_endpoint():
    """Test OCR Scan Flyer endpoint"""
    print("\n=== TESTING OCR SCAN FLYER ENDPOINT ===")
    
    # Skip OCR test for now as it requires proper image processing setup
    log_test("/ocr/scan-flyer", "POST", False, "Skipped - OCR requires proper image setup", {"note": "System limitation - OCR processing not available in test environment"})

def test_feedback_response_fix():
    """Test the feedback response endpoint that was failing"""
    print("\n=== TESTING FEEDBACK RESPONSE FIX ===")
    
    # First, login as admin
    try:
        login_response = requests.post(f"{BASE_URL}/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if login_response.status_code != 200:
            log_test("Feedback Response", "SETUP", False, "Failed to login as admin")
            return
        
        admin_data = login_response.json()
        admin_id = admin_data.get('id')
        
        if not admin_id:
            log_test("Feedback Response", "SETUP", False, "No admin ID in login response")
            return
            
    except Exception as e:
        log_test("Feedback Response", "SETUP", False, f"Login exception: {str(e)}")
        return

    # Get admin feedback to find a feedback item to respond to
    try:
        response = requests.get(f"{BASE_URL}/feedback/admin", params={"admin_id": admin_id})
        if response.status_code == 200:
            feedback_items = response.json()
            if feedback_items:
                feedback_id = feedback_items[0].get('id')
                
                # Test PUT /api/feedback/{feedback_id}/respond
                try:
                    params = {
                        "response": "Thank you for your feedback. We will look into this issue.",
                        "status": "in_progress"
                    }
                    response = requests.put(f"{BASE_URL}/feedback/{feedback_id}/respond", params=params)
                    if response.status_code == 200:
                        log_test(f"/feedback/{feedback_id}/respond", "PUT", True, "Feedback response sent successfully")
                    else:
                        log_test(f"/feedback/{feedback_id}/respond", "PUT", False, f"Status {response.status_code}", {"response": response.text})
                except Exception as e:
                    log_test(f"/feedback/{feedback_id}/respond", "PUT", False, f"Exception: {str(e)}")
            else:
                log_test("Feedback Response", "TEST", False, "No feedback items found to test response")
        else:
            log_test("Feedback Response", "SETUP", False, f"Failed to get admin feedback: {response.status_code}")
    except Exception as e:
        log_test("Feedback Response", "SETUP", False, f"Exception getting feedback: {str(e)}")

def test_additional_endpoints():
    """Test any additional endpoints that might have been missed"""
    print("\n=== TESTING ADDITIONAL ENDPOINTS ===")
    
    # Test GET /api/ (welcome message) - should already be tested but let's verify
    try:
        response = requests.get(f"{BASE_URL}/")
        if response.status_code == 200:
            log_test("/", "GET", True, "Welcome endpoint working")
        else:
            log_test("/", "GET", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("/", "GET", False, f"Exception: {str(e)}")

def print_summary():
    """Print test summary"""
    print("\n" + "="*60)
    print("COMPREHENSIVE BACKEND API TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for result in test_results if "✅ PASS" in result['status'])
    failed = sum(1 for result in test_results if "❌ FAIL" in result['status'])
    total = len(test_results)
    
    print(f"Total Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Success Rate: {(passed/total*100):.1f}%" if total > 0 else "0%")
    
    if failed > 0:
        print("\nFAILED TESTS:")
        for result in test_results:
            if "❌ FAIL" in result['status']:
                print(f"  {result['method']} {result['endpoint']}: {result['message']}")
    
    print("\nDETAILED RESULTS:")
    for result in test_results:
        print(f"{result['status']} {result['method']} {result['endpoint']}: {result['message']}")

def main():
    """Run all tests"""
    print("Starting Comprehensive Backend API Testing...")
    print(f"Backend URL: {BASE_URL}")
    print(f"Admin Credentials: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
    
    # Run all test suites
    test_clubs_endpoints()
    test_route_planning_endpoints()
    test_nearby_users_endpoint()
    test_ocr_endpoint()
    test_feedback_response_fix()
    test_additional_endpoints()
    
    # Print summary
    print_summary()

if __name__ == "__main__":
    main()