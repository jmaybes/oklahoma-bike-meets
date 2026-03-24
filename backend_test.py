#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Oklahoma Car Events App
Testing Automated Event Search API endpoints
"""

import asyncio
import httpx
import json
import sys
from datetime import datetime

# Backend URL from frontend environment
BACKEND_URL = "https://garage-okc.preview.emergentagent.com/api"

# Admin credentials from review request
ADMIN_EMAIL = "admin@okcarevents.com"
ADMIN_PASSWORD = "admin123"

# Test results tracking
test_results = []
admin_id = None

def log_test(test_name, success, details="", response_data=None):
    """Log test results"""
    result = {
        "test": test_name,
        "success": success,
        "details": details,
        "timestamp": datetime.now().isoformat()
    }
    if response_data:
        result["response_data"] = response_data
    test_results.append(result)
    
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"    {details}")
    if not success and response_data:
        print(f"    Response: {response_data}")
    print()

async def test_admin_login():
    """Test 1: Get Admin User ID by logging in"""
    global admin_id
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(f"{BACKEND_URL}/auth/login", json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data:
                    admin_id = data["id"]
                    is_admin = data.get("isAdmin", False)
                    
                    if is_admin:
                        log_test("Admin Login", True, f"Successfully logged in as admin. Admin ID: {admin_id}")
                        return True
                    else:
                        log_test("Admin Login", False, "User is not an admin", data)
                        return False
                else:
                    log_test("Admin Login", False, "Invalid response structure", data)
                    return False
            else:
                log_test("Admin Login", False, f"HTTP {response.status_code}", response.text)
                return False
                
    except Exception as e:
        log_test("Admin Login", False, f"Exception: {str(e)}")
        return False

async def test_manual_event_search():
    """Test 2: Manual Event Search Trigger"""
    if not admin_id:
        log_test("Manual Event Search", False, "Admin ID not available")
        return False
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:  # Longer timeout for search
            response = await client.post(f"{BACKEND_URL}/admin/events/search?admin_id={admin_id}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and "stats" in data:
                    stats = data["stats"]
                    events_found = stats.get("events_found", 0)
                    events_imported = stats.get("events_imported", 0)
                    duplicates_skipped = stats.get("duplicates_skipped", 0)
                    
                    log_test("Manual Event Search", True, 
                            f"Search completed. Found: {events_found}, Imported: {events_imported}, Duplicates: {duplicates_skipped}",
                            data)
                    return True
                else:
                    log_test("Manual Event Search", False, "Invalid response structure", data)
                    return False
            else:
                log_test("Manual Event Search", False, f"HTTP {response.status_code}", response.text)
                return False
                
    except Exception as e:
        log_test("Manual Event Search", False, f"Exception: {str(e)}")
        return False

async def test_get_pending_events():
    """Test 3: Get Pending Events"""
    if not admin_id:
        log_test("Get Pending Events", False, "Admin ID not available")
        return []
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{BACKEND_URL}/admin/events/pending?admin_id={admin_id}")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    # Direct array response
                    events = data
                    count = len(events)
                elif "events" in data and "count" in data:
                    # Wrapped response
                    events = data["events"]
                    count = data["count"]
                else:
                    log_test("Get Pending Events", False, "Invalid response structure", data)
                    return []
                
                # Verify event structure
                if events and len(events) > 0:
                    sample_event = events[0]
                    required_fields = ["id", "title", "date", "time", "location", "city", "eventType", "photos"]
                    missing_fields = [field for field in required_fields if field not in sample_event]
                    
                    if missing_fields:
                        log_test("Get Pending Events", False, 
                                f"Missing required fields: {missing_fields}", sample_event)
                        return events
                    
                    # Check source and approval status (be flexible about source field)
                    source = sample_event.get("source")
                    if source is not None and source != "auto_search":
                        log_test("Get Pending Events", False, 
                                f"Expected source='auto_search' or None, got '{source}'")
                        return events
                    
                    if sample_event.get("isApproved") != False:
                        log_test("Get Pending Events", False, 
                                f"Expected isApproved=false, got '{sample_event.get('isApproved')}'")
                        return events
                
                log_test("Get Pending Events", True, 
                        f"Retrieved {count} pending events. All have required fields and correct status.",
                        {"count": count, "sample_fields": list(events[0].keys()) if events else []})
                return events
            else:
                log_test("Get Pending Events", False, f"HTTP {response.status_code}", response.text)
                return []
                
    except Exception as e:
        log_test("Get Pending Events", False, f"Exception: {str(e)}")
        return []

async def test_approve_single_event(event_id):
    """Test 4: Approve Single Event"""
    if not admin_id or not event_id:
        log_test("Approve Single Event", False, "Admin ID or Event ID not available")
        return False
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(f"{BACKEND_URL}/admin/events/{event_id}/approve?admin_id={admin_id}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    log_test("Approve Single Event", True, f"Event {event_id} approved successfully", data)
                    return True
                else:
                    log_test("Approve Single Event", False, "Success flag not set", data)
                    return False
            else:
                log_test("Approve Single Event", False, f"HTTP {response.status_code}", response.text)
                return False
                
    except Exception as e:
        log_test("Approve Single Event", False, f"Exception: {str(e)}")
        return False

async def test_reject_event(event_id):
    """Test 5: Reject Event"""
    if not admin_id or not event_id:
        log_test("Reject Event", False, "Admin ID or Event ID not available")
        return False
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.delete(f"{BACKEND_URL}/admin/events/{event_id}/reject?admin_id={admin_id}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") or "message" in data:
                    log_test("Reject Event", True, f"Event {event_id} rejected and deleted successfully", data)
                    return True
                else:
                    log_test("Reject Event", False, "Invalid response structure", data)
                    return False
            else:
                log_test("Reject Event", False, f"HTTP {response.status_code}", response.text)
                return False
                
    except Exception as e:
        log_test("Reject Event", False, f"Exception: {str(e)}")
        return False

async def test_approve_all_events():
    """Test 6: Approve All Events"""
    if not admin_id:
        log_test("Approve All Events", False, "Admin ID not available")
        return False
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(f"{BACKEND_URL}/admin/events/approve-all?admin_id={admin_id}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and "count" in data:
                    count = data["count"]
                    log_test("Approve All Events", True, f"Approved {count} events successfully", data)
                    return True
                else:
                    log_test("Approve All Events", False, "Invalid response structure", data)
                    return False
            else:
                log_test("Approve All Events", False, f"HTTP {response.status_code}", response.text)
                return False
                
    except Exception as e:
        log_test("Approve All Events", False, f"Exception: {str(e)}")
        return False

async def test_search_logs():
    """Test 7: Search Logs"""
    if not admin_id:
        log_test("Search Logs", False, "Admin ID not available")
        return False
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{BACKEND_URL}/admin/events/search-logs?admin_id={admin_id}&limit=5")
            
            if response.status_code == 200:
                data = response.json()
                if "logs" in data:
                    logs = data["logs"]
                    
                    # Verify log structure
                    if logs and len(logs) > 0:
                        sample_log = logs[0]
                        required_fields = ["timestamp", "stats"]
                        missing_fields = [field for field in required_fields if field not in sample_log]
                        
                        if missing_fields:
                            log_test("Search Logs", False, 
                                    f"Missing required fields in logs: {missing_fields}", sample_log)
                            return False
                    
                    log_test("Search Logs", True, 
                            f"Retrieved {len(logs)} search logs with proper structure",
                            {"log_count": len(logs), "sample_fields": list(logs[0].keys()) if logs else []})
                    return True
                else:
                    log_test("Search Logs", False, "Invalid response structure", data)
                    return False
            else:
                log_test("Search Logs", False, f"HTTP {response.status_code}", response.text)
                return False
                
    except Exception as e:
        log_test("Search Logs", False, f"Exception: {str(e)}")
        return False

async def test_scheduled_search():
    """Test 8: Scheduled Search Endpoint"""
    secret_key = "okc-car-events-weekly-search-2025"
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:  # Longer timeout for search
            response = await client.post(f"{BACKEND_URL}/scheduler/weekly-event-search?secret_key={secret_key}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and "stats" in data:
                    stats = data["stats"]
                    log_test("Scheduled Search", True, 
                            f"Weekly search completed successfully. Stats: {stats}", data)
                    return True
                else:
                    log_test("Scheduled Search", False, "Invalid response structure", data)
                    return False
            else:
                log_test("Scheduled Search", False, f"HTTP {response.status_code}", response.text)
                return False
                
    except Exception as e:
        log_test("Scheduled Search", False, f"Exception: {str(e)}")
        return False

async def test_access_control():
    """Test 9: Access Control"""
    
    # Test 1: Access without admin_id
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{BACKEND_URL}/admin/events/pending")
            
            if response.status_code == 422:  # FastAPI validation error for missing query param
                log_test("Access Control - No Admin ID", True, "Correctly rejected request without admin_id")
            else:
                log_test("Access Control - No Admin ID", False, f"Expected 422, got {response.status_code}")
    except Exception as e:
        log_test("Access Control - No Admin ID", False, f"Exception: {str(e)}")
    
    # Test 2: Access with invalid admin_id
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{BACKEND_URL}/admin/events/pending?admin_id=invalid_id")
            
            if response.status_code == 400:  # Invalid ObjectId
                log_test("Access Control - Invalid Admin ID", True, "Correctly rejected invalid admin_id")
            else:
                log_test("Access Control - Invalid Admin ID", False, f"Expected 400, got {response.status_code}")
    except Exception as e:
        log_test("Access Control - Invalid Admin ID", False, f"Exception: {str(e)}")
    
    # Test 3: Access with non-admin user (create a regular user first)
    try:
        import random
        random_suffix = random.randint(1000, 9999)
        test_email = f"testuser{random_suffix}@example.com"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Register a regular user
            reg_response = await client.post(f"{BACKEND_URL}/auth/register", json={
                "name": "Test User",
                "nickname": f"testuser{random_suffix}",
                "email": test_email,
                "password": "testpass123"
            })
            
            if reg_response.status_code == 200:
                # Login as regular user
                login_response = await client.post(f"{BACKEND_URL}/auth/login", json={
                    "email": test_email,
                    "password": "testpass123"
                })
                
                if login_response.status_code == 200:
                    user_data = login_response.json()
                    regular_user_id = user_data["id"]
                    
                    # Try to access admin endpoint
                    admin_response = await client.get(f"{BACKEND_URL}/admin/events/pending?admin_id={regular_user_id}")
                    
                    if admin_response.status_code == 403:  # Forbidden
                        log_test("Access Control - Non-Admin User", True, "Correctly rejected non-admin user")
                    else:
                        log_test("Access Control - Non-Admin User", False, f"Expected 403, got {admin_response.status_code}")
                else:
                    log_test("Access Control - Non-Admin User", False, "Failed to login as regular user")
            else:
                log_test("Access Control - Non-Admin User", False, "Failed to register regular user")
                
    except Exception as e:
        log_test("Access Control - Non-Admin User", False, f"Exception: {str(e)}")
    
    # Test 4: Scheduled endpoint with wrong secret key
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(f"{BACKEND_URL}/scheduler/weekly-event-search?secret_key=wrong_key")
            
            if response.status_code == 403:
                log_test("Access Control - Wrong Secret Key", True, "Correctly rejected wrong secret key")
            else:
                log_test("Access Control - Wrong Secret Key", False, f"Expected 403, got {response.status_code}")
    except Exception as e:
        log_test("Access Control - Wrong Secret Key", False, f"Exception: {str(e)}")

async def verify_pending_events_removed(event_id):
    """Verify that approved/rejected events no longer appear in pending list"""
    if not admin_id:
        return False
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{BACKEND_URL}/admin/events/pending?admin_id={admin_id}")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    events = data
                elif "events" in data:
                    events = data["events"]
                else:
                    log_test("Verify Event Removal", False, f"Invalid response structure")
                    return False
                
                # Check if the event is still in pending list
                for event in events:
                    if event.get("id") == event_id:
                        log_test("Verify Event Removal", False, f"Event {event_id} still appears in pending list")
                        return False
                
                log_test("Verify Event Removal", True, f"Event {event_id} correctly removed from pending list")
                return True
            else:
                log_test("Verify Event Removal", False, f"Failed to get pending events: HTTP {response.status_code}")
                return False
                
    except Exception as e:
        log_test("Verify Event Removal", False, f"Exception: {str(e)}")
        return False

async def main():
    """Main test execution"""
    print("🚀 Starting Automated Event Search API Testing")
    print("=" * 60)
    print()
    
    # Test 1: Admin Login
    if not await test_admin_login():
        print("❌ Cannot proceed without admin access")
        return
    
    # Test 2: Manual Event Search Trigger
    await test_manual_event_search()
    
    # Test 3: Get Pending Events
    pending_events = await test_get_pending_events()
    
    # Test 4 & 5: Approve/Reject Events (if we have pending events)
    if pending_events and len(pending_events) >= 2:
        # Test approve on first event
        first_event_id = pending_events[0]["id"]
        if await test_approve_single_event(first_event_id):
            await verify_pending_events_removed(first_event_id)
        
        # Test reject on second event
        if len(pending_events) > 1:
            second_event_id = pending_events[1]["id"]
            if await test_reject_event(second_event_id):
                await verify_pending_events_removed(second_event_id)
    else:
        log_test("Approve Single Event", False, "No pending events available for testing")
        log_test("Reject Event", False, "No pending events available for testing")
    
    # Test 6: Approve All Events
    await test_approve_all_events()
    
    # Test 7: Search Logs
    await test_search_logs()
    
    # Test 8: Scheduled Search
    await test_scheduled_search()
    
    # Test 9: Access Control
    await test_access_control()
    
    # Summary
    print("=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for result in test_results if result["success"])
    total = len(test_results)
    
    print(f"Total Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    print(f"Success Rate: {(passed/total)*100:.1f}%")
    print()
    
    # Show failed tests
    failed_tests = [result for result in test_results if not result["success"]]
    if failed_tests:
        print("❌ FAILED TESTS:")
        for test in failed_tests:
            print(f"  - {test['test']}: {test['details']}")
        print()
    
    # Show critical issues
    critical_failures = [
        result for result in test_results 
        if not result["success"] and any(keyword in result["test"].lower() 
        for keyword in ["login", "search", "pending", "approve"])
    ]
    
    if critical_failures:
        print("🚨 CRITICAL ISSUES:")
        for test in critical_failures:
            print(f"  - {test['test']}: {test['details']}")
    else:
        print("✅ All critical functionality working!")
    
    print()
    print("🏁 Testing completed!")

if __name__ == "__main__":
    asyncio.run(main())