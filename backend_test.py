#!/usr/bin/env python3
"""
Backend API Testing Script for Oklahoma Car Events
Testing the newly implemented features as requested in review.
"""

import asyncio
import httpx
import json
import os
from datetime import datetime
from typing import Dict, List, Optional

# Get backend URL from frontend environment
BACKEND_URL = "https://drive-okc.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.test_results = []
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
    
    def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append(f"[{timestamp}] {status} {test_name}: {details}")
        print(f"[{timestamp}] {status} {test_name}: {details}")
    
    async def test_feedback_admin_endpoints(self):
        """Test Admin Feedback Management API endpoints"""
        print("\n🔧 Testing Admin Feedback Management API...")
        
        try:
            # First, create test feedback data if needed
            await self.create_test_feedback()
            
            # 1. Test GET /api/feedback/admin - Get all feedback
            response = await self.client.get(f"{BACKEND_URL}/feedback/admin")
            if response.status_code == 200:
                feedback_data = response.json()
                self.log_result("GET /api/feedback/admin", True, f"Retrieved {len(feedback_data)} feedback items")
            else:
                self.log_result("GET /api/feedback/admin", False, f"Status: {response.status_code}")
            
            # 2. Test GET /api/feedback/admin?status=new - Filter by status
            response = await self.client.get(f"{BACKEND_URL}/feedback/admin?status=new")
            if response.status_code == 200:
                new_feedback = response.json()
                self.log_result("GET /api/feedback/admin?status=new", True, f"Retrieved {len(new_feedback)} new feedback items")
                
                # Use the first feedback item for further testing
                if new_feedback:
                    feedback_id = new_feedback[0]["id"]
                    
                    # 3. Test PUT /api/feedback/{feedback_id}/status?status=in_progress
                    response = await self.client.put(f"{BACKEND_URL}/feedback/{feedback_id}/status?status=in_progress")
                    if response.status_code == 200:
                        self.log_result("PUT /api/feedback/{feedback_id}/status", True, "Status updated to in_progress")
                    else:
                        self.log_result("PUT /api/feedback/{feedback_id}/status", False, f"Status: {response.status_code}")
                    
                    # 4. Test PUT /api/feedback/{feedback_id}/respond
                    response = await self.client.put(f"{BACKEND_URL}/feedback/{feedback_id}/respond?response=test response&status=resolved")
                    if response.status_code == 200:
                        result_data = response.json()
                        self.log_result("PUT /api/feedback/{feedback_id}/respond", True, f"Response added: {result_data.get('adminResponse', 'N/A')}")
                    else:
                        self.log_result("PUT /api/feedback/{feedback_id}/respond", False, f"Status: {response.status_code}")
                else:
                    self.log_result("Feedback status/respond tests", False, "No feedback available for testing")
            else:
                self.log_result("GET /api/feedback/admin?status=new", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_result("Feedback Admin API", False, f"Exception: {str(e)}")
    
    async def test_websocket_online_status_api(self):
        """Test WebSocket Online Status API endpoints"""
        print("\n🌐 Testing WebSocket Online Status API...")
        
        try:
            # 1. Test GET /api/messages/online - Get list of online users
            response = await self.client.get(f"{BACKEND_URL}/messages/online")
            if response.status_code == 200:
                online_data = response.json()
                online_users = online_data.get("online_users", [])
                self.log_result("GET /api/messages/online", True, f"Online users: {len(online_users)} users - {online_users}")
            else:
                self.log_result("GET /api/messages/online", False, f"Status: {response.status_code}")
            
            # 2. Test GET /api/messages/online/{user_id} - Check if specific user is online
            # Use a test user ID
            test_user_id = "674123456789abcdef123456"  # Example user ID
            response = await self.client.get(f"{BACKEND_URL}/messages/online/{test_user_id}")
            if response.status_code == 200:
                user_status = response.json()
                is_online = user_status.get("online", False)
                self.log_result("GET /api/messages/online/{user_id}", True, f"User online status: {is_online}")
            else:
                self.log_result("GET /api/messages/online/{user_id}", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_result("WebSocket Online Status API", False, f"Exception: {str(e)}")
    
    async def test_event_import_api(self):
        """Test Event Import API"""
        print("\n📅 Testing Event Import API...")
        
        try:
            # First, get or create a test admin user
            admin_id = await self.get_admin_user_id()
            
            if admin_id:
                # Test POST /api/admin/events/import?admin_id={admin_id}
                response = await self.client.post(f"{BACKEND_URL}/admin/events/import?admin_id={admin_id}")
                if response.status_code == 200:
                    import_stats = response.json()
                    total = import_stats.get("total", 0)
                    new = import_stats.get("new", 0)
                    duplicates = import_stats.get("duplicates", 0)
                    errors = import_stats.get("errors", 0)
                    self.log_result("POST /api/admin/events/import", True, f"Stats: total={total}, new={new}, duplicates={duplicates}, errors={errors}")
                else:
                    self.log_result("POST /api/admin/events/import", False, f"Status: {response.status_code}, Response: {response.text}")
            else:
                self.log_result("POST /api/admin/events/import", False, "No admin user available for testing")
                
        except Exception as e:
            self.log_result("Event Import API", False, f"Exception: {str(e)}")
    
    async def test_events_with_images(self):
        """Test Events with Images - verify events have photos field populated"""
        print("\n🖼️  Testing Events with Images...")
        
        try:
            # Get all events and check if they have photos field
            response = await self.client.get(f"{BACKEND_URL}/events")
            if response.status_code == 200:
                events = response.json()
                self.log_result("GET /api/events", True, f"Retrieved {len(events)} events")
                
                events_with_photos = 0
                for event in events:
                    if "photos" in event:
                        photos = event.get("photos", [])
                        if photos:  # Has actual photo URLs
                            events_with_photos += 1
                            self.log_result(f"Event '{event['title']}'", True, f"Has {len(photos)} photos: {photos[:2]}...")  # Show first 2 URLs
                        else:
                            # Event has photos field but empty
                            pass
                    else:
                        self.log_result(f"Event '{event['title']}'", False, "Missing photos field")
                
                if events:
                    self.log_result("Events photos field verification", True, f"{len(events)} events have photos field, {events_with_photos} have actual images")
                else:
                    self.log_result("Events photos field verification", False, "No events found to test")
            else:
                self.log_result("GET /api/events", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_result("Events with Images", False, f"Exception: {str(e)}")
    
    async def create_test_feedback(self):
        """Create test feedback if none exists"""
        try:
            # Check if any feedback exists first
            response = await self.client.get(f"{BACKEND_URL}/feedback/admin")
            if response.status_code == 200 and len(response.json()) > 0:
                return  # Feedback already exists
            
            # Create test user first if needed
            test_user = await self.get_or_create_test_user()
            
            if test_user:
                feedback_data = {
                    "userId": test_user["id"],
                    "userName": test_user["name"],
                    "userEmail": test_user["email"],
                    "type": "suggestion",
                    "subject": "Test feedback for admin testing",
                    "message": "This is a test feedback created for testing admin feedback management functionality."
                }
                
                response = await self.client.post(f"{BACKEND_URL}/feedback", json=feedback_data)
                if response.status_code == 200:
                    self.log_result("Create test feedback", True, "Test feedback created successfully")
                else:
                    self.log_result("Create test feedback", False, f"Failed to create: {response.status_code}")
        except Exception as e:
            self.log_result("Create test feedback", False, f"Exception: {str(e)}")
    
    async def get_or_create_test_user(self):
        """Get or create a test user for feedback testing"""
        try:
            # Try to register a test user
            user_data = {
                "email": "testuser@carevents.test",
                "name": "Test User",
                "password": "testpass123",
                "nickname": "TestDriver",
                "isAdmin": False
            }
            
            response = await self.client.post(f"{BACKEND_URL}/auth/register", json=user_data)
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 400:  # Already exists
                # Try to login instead
                login_data = {
                    "email": "testuser@carevents.test", 
                    "password": "testpass123"
                }
                response = await self.client.post(f"{BACKEND_URL}/auth/login", json=login_data)
                if response.status_code == 200:
                    return response.json()
            
            return None
        except:
            return None
    
    async def get_admin_user_id(self):
        """Get an admin user ID for event import testing"""
        try:
            # Try to create/get admin user
            admin_data = {
                "email": "admin@carevents.test",
                "name": "Admin User", 
                "password": "adminpass123",
                "nickname": "CarAdmin",
                "isAdmin": True
            }
            
            response = await self.client.post(f"{BACKEND_URL}/auth/register", json=admin_data)
            if response.status_code == 200:
                return response.json()["id"]
            elif response.status_code == 400:  # Already exists
                # Try to login
                login_data = {
                    "email": "admin@carevents.test",
                    "password": "adminpass123" 
                }
                response = await self.client.post(f"{BACKEND_URL}/auth/login", json=login_data)
                if response.status_code == 200:
                    return response.json()["id"]
            
            return None
        except:
            return None
    
    async def run_all_tests(self):
        """Run all backend tests for the review request features"""
        print(f"🚀 Starting Backend API Tests for newly implemented features")
        print(f"📡 Backend URL: {BACKEND_URL}")
        print("=" * 80)
        
        # Test all the requested features
        await self.test_feedback_admin_endpoints()
        await self.test_websocket_online_status_api() 
        await self.test_event_import_api()
        await self.test_events_with_images()
        
        print("\n" + "=" * 80)
        print("📋 FINAL TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for result in self.test_results if "✅ PASS" in result)
        failed = sum(1 for result in self.test_results if "❌ FAIL" in result)
        
        print(f"Total Tests: {len(self.test_results)}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        
        if failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if "❌ FAIL" in result:
                    print(f"  {result}")
        
        print("\n📊 ALL TEST RESULTS:")
        for result in self.test_results:
            print(f"  {result}")
        
        return passed, failed


async def main():
    """Main test runner"""
    async with BackendTester() as tester:
        passed, failed = await tester.run_all_tests()
        return failed == 0  # Return True if all tests passed


if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)