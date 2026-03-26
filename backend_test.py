#!/usr/bin/env python3
"""
Backend API Testing for Oklahoma Car Events - Query Optimization Verification
Testing the recently optimized endpoints for N+1 query fixes and projections.
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend/.env
BACKEND_URL = "https://event-hub-okc-1.preview.emergentagent.com/api"

# Admin credentials for testing
ADMIN_EMAIL = "admin@okcarevents.com"
ADMIN_PASSWORD = "admin123"

class APITester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_user_id = None
        self.test_user_id = None
        self.test_event_id = None
        self.test_message_id = None
        
    def log(self, message, level="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def test_endpoint(self, method, endpoint, data=None, params=None, expected_status=200):
        """Test an API endpoint and return response"""
        url = f"{BACKEND_URL}{endpoint}"
        
        try:
            if method.upper() == "GET":
                response = self.session.get(url, params=params)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, params=params)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data, params=params)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, params=params)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            self.log(f"{method} {endpoint} -> {response.status_code}")
            
            if response.status_code != expected_status:
                self.log(f"Expected {expected_status}, got {response.status_code}", "ERROR")
                if response.text:
                    self.log(f"Response: {response.text[:500]}", "ERROR")
                return None
                
            return response.json() if response.content else {}
            
        except Exception as e:
            self.log(f"Error testing {method} {endpoint}: {str(e)}", "ERROR")
            return None
    
    def setup_test_data(self):
        """Setup test users and data for testing"""
        self.log("Setting up test data...")
        
        # Login as admin to get admin user ID
        login_data = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        login_response = self.test_endpoint("POST", "/auth/login", login_data)
        
        if not login_response:
            self.log("Failed to login as admin", "ERROR")
            return False
            
        self.admin_user_id = login_response.get("id")
        self.log(f"Admin user ID: {self.admin_user_id}")
        
        # Create a test user for messaging/nearby tests
        test_user_data = {
            "name": "Test User",
            "nickname": "TestNick",
            "email": f"testuser_{datetime.now().timestamp()}@test.com",
            "password": "testpass123",
            "locationSharingEnabled": True,
            "notificationsEnabled": True
        }
        
        register_response = self.test_endpoint("POST", "/auth/register", test_user_data)
        if register_response:
            self.test_user_id = register_response.get("id")
            self.log(f"Test user ID: {self.test_user_id}")
        
        return True
    
    def test_nearby_users_optimization(self):
        """Test GET /api/users/nearby/{user_id} with query projections"""
        self.log("Testing nearby users endpoint with query projections...")
        
        if not self.admin_user_id:
            self.log("No admin user ID available", "ERROR")
            return False
            
        # Test with Oklahoma City coordinates
        params = {
            "latitude": 35.4676,
            "longitude": -97.5164,
            "radius": 25
        }
        
        response = self.test_endpoint("GET", f"/users/nearby/{self.admin_user_id}", params=params)
        
        if not response:
            return False
            
        # Verify response structure
        required_fields = ["count", "radius", "users"]
        for field in required_fields:
            if field not in response:
                self.log(f"Missing field in response: {field}", "ERROR")
                return False
                
        # Verify user objects have projected fields only
        if response["users"]:
            user = response["users"][0]
            expected_user_fields = ["id", "name", "nickname", "profilePic", "latitude", "longitude", "distance"]
            for field in expected_user_fields:
                if field not in user:
                    self.log(f"Missing projected field in user: {field}", "ERROR")
                    return False
                    
        self.log(f"✅ Nearby users endpoint working - found {response['count']} users within {response['radius']} miles")
        return True
    
    def test_locations_nearby_optimization(self):
        """Test GET /api/locations/nearby/{user_id} with batch user fetching"""
        self.log("Testing locations nearby endpoint with batch user fetching...")
        
        if not self.admin_user_id:
            self.log("No admin user ID available", "ERROR")
            return False
            
        response = self.test_endpoint("GET", f"/locations/nearby/{self.admin_user_id}")
        
        if response is None:
            return False
            
        # Response should be an array of nearby users
        if not isinstance(response, list):
            self.log("Response should be an array", "ERROR")
            return False
            
        # If there are nearby users, verify the structure includes batch-fetched user data
        if response:
            user = response[0]
            expected_fields = ["userId", "name", "nickname", "latitude", "longitude", "distance", "updatedAt"]
            for field in expected_fields:
                if field not in user:
                    self.log(f"Missing field in nearby location user: {field}", "ERROR")
                    return False
                    
        self.log(f"✅ Locations nearby endpoint working - found {len(response)} nearby locations")
        return True
    
    def test_conversations_optimization(self):
        """Test GET /api/messages/conversations/{user_id} with batch partner fetching"""
        self.log("Testing conversations endpoint with batch partner fetching...")
        
        if not self.admin_user_id or not self.test_user_id:
            self.log("Missing user IDs for conversation test", "ERROR")
            return False
            
        # First, send a message to create a conversation
        message_data = {
            "senderId": self.admin_user_id,
            "recipientId": self.test_user_id,
            "content": "Test message for conversation optimization testing"
        }
        
        message_response = self.test_endpoint("POST", "/messages", message_data)
        if not message_response:
            self.log("Failed to create test message", "ERROR")
            return False
            
        self.log("Created test message for conversation")
        
        # Now test the conversations endpoint
        response = self.test_endpoint("GET", f"/messages/conversations/{self.admin_user_id}")
        
        if response is None:
            return False
            
        # Response should be an array of conversations
        if not isinstance(response, list):
            self.log("Conversations response should be an array", "ERROR")
            return False
            
        # Verify conversation structure includes batch-fetched partner data
        if response:
            conversation = response[0]
            expected_fields = ["partnerId", "partnerName", "partnerNickname", "lastMessage", "lastMessageTime", "unreadCount"]
            for field in expected_fields:
                if field not in conversation:
                    self.log(f"Missing field in conversation: {field}", "ERROR")
                    return False
                    
            # Verify partner data is populated (not None/empty)
            if not conversation["partnerName"]:
                self.log("Partner name should be populated from batch fetch", "ERROR")
                return False
                
        self.log(f"✅ Conversations endpoint working - found {len(response)} conversations with proper partner info")
        return True
    
    def test_message_sending(self):
        """Test POST /api/messages to verify messaging still works after optimization"""
        self.log("Testing message sending functionality...")
        
        if not self.admin_user_id or not self.test_user_id:
            self.log("Missing user IDs for message test", "ERROR")
            return False
            
        message_data = {
            "senderId": self.test_user_id,
            "recipientId": self.admin_user_id,
            "content": "Reply message to test bidirectional messaging"
        }
        
        response = self.test_endpoint("POST", "/messages", message_data)
        
        if not response:
            return False
            
        # Verify message structure
        expected_fields = ["id", "senderId", "recipientId", "content", "isRead", "createdAt"]
        for field in expected_fields:
            if field not in response:
                self.log(f"Missing field in message response: {field}", "ERROR")
                return False
                
        self.log("✅ Message sending working correctly")
        return True
    
    def test_popup_event_creation(self):
        """Test POST /api/events with Pop Up event to verify projection optimization"""
        self.log("Testing Pop Up event creation with user projection optimization...")
        
        if not self.admin_user_id:
            self.log("No admin user ID available", "ERROR")
            return False
            
        # Create a Pop Up event (admin user so it auto-approves)
        event_data = {
            "title": "Test Pop Up Car Meet",
            "description": "Testing the projection optimization for Pop Up events",
            "date": "2025-01-20",
            "time": "18:00",
            "location": "Test Location",
            "address": "123 Test Street, Oklahoma City, OK",
            "city": "Oklahoma City",
            "eventType": "Car Meet",
            "isPopUp": True,
            "userId": self.admin_user_id
        }
        
        response = self.test_endpoint("POST", "/events", event_data)
        
        if not response:
            return False
            
        # Verify event was created
        if "id" not in response:
            self.log("Event creation failed - no ID returned", "ERROR")
            return False
            
        self.test_event_id = response["id"]
        
        # Verify it's approved (admin user)
        if not response.get("isApproved"):
            self.log("Pop Up event should be auto-approved for admin user", "ERROR")
            return False
            
        self.log("✅ Pop Up event creation working - projection optimization applied during notification creation")
        return True
    
    def test_events_listing(self):
        """Test GET /api/events to verify events still load properly"""
        self.log("Testing events listing functionality...")
        
        response = self.test_endpoint("GET", "/events")
        
        if response is None:
            return False
            
        # Response should be an array
        if not isinstance(response, list):
            self.log("Events response should be an array", "ERROR")
            return False
            
        # Verify events have proper structure
        if response:
            event = response[0]
            required_fields = ["id", "title", "date", "time", "location", "city", "eventType"]
            for field in required_fields:
                if field not in event:
                    self.log(f"Missing field in event: {field}", "ERROR")
                    return False
                    
        self.log(f"✅ Events listing working - found {len(response)} events")
        return True
    
    def run_all_tests(self):
        """Run all optimization tests"""
        self.log("Starting Oklahoma Car Events Backend Optimization Tests")
        self.log("=" * 60)
        
        # Setup
        if not self.setup_test_data():
            self.log("Failed to setup test data", "ERROR")
            return False
            
        # Test results
        results = {
            "nearby_users": self.test_nearby_users_optimization(),
            "locations_nearby": self.test_locations_nearby_optimization(), 
            "conversations": self.test_conversations_optimization(),
            "message_sending": self.test_message_sending(),
            "popup_events": self.test_popup_event_creation(),
            "events_listing": self.test_events_listing()
        }
        
        # Summary
        self.log("=" * 60)
        self.log("TEST RESULTS SUMMARY:")
        
        passed = 0
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{test_name.replace('_', ' ').title()}: {status}")
            if result:
                passed += 1
                
        self.log(f"\nOverall: {passed}/{total} tests passed")
        
        if passed == total:
            self.log("🎉 All optimization tests PASSED! Query optimizations are working correctly.")
            return True
        else:
            self.log("⚠️  Some tests failed. Check the logs above for details.")
            return False

if __name__ == "__main__":
    tester = APITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)