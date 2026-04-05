#!/usr/bin/env python3
"""
Oklahoma Car Events Backend API Testing with Production Data
Testing specific endpoints after production database import
"""

import requests
import json
import sys
from typing import Dict, Any, List

# Backend URL from environment
BACKEND_URL = "https://event-hub-okc-1.preview.emergentagent.com/api"

# Admin credentials from review request
ADMIN_EMAIL = "admin@okcarevents.com"
ADMIN_PASSWORD = "admin123"
ADMIN_USER_ID = "69bb035fb5d3f5e057f073ca"

class ProductionDataTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.test_results = []
        
    def log_test(self, endpoint: str, status: str, details: str = "", response_data: Any = None):
        """Log test results"""
        result = {
            "endpoint": endpoint,
            "status": status,
            "details": details,
            "response_data": response_data
        }
        self.test_results.append(result)
        status_emoji = "✅" if status == "PASS" else "❌"
        print(f"{status_emoji} {endpoint}: {status}")
        if details:
            print(f"   Details: {details}")
        if status == "FAIL" and response_data:
            print(f"   Response: {response_data}")
        print()

    def test_admin_login(self) -> bool:
        """Test admin login and store token"""
        print("🔐 Testing Admin Login...")
        
        try:
            response = self.session.post(
                f"{BACKEND_URL}/auth/login",
                json={
                    "email": ADMIN_EMAIL,
                    "password": ADMIN_PASSWORD
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("isAdmin") == True:
                    self.admin_token = data.get("id")  # Using user ID as token
                    self.log_test(
                        "POST /api/auth/login",
                        "PASS",
                        f"Admin login successful. User ID: {self.admin_token}, isAdmin: {data.get('isAdmin')}"
                    )
                    return True
                else:
                    self.log_test(
                        "POST /api/auth/login",
                        "FAIL",
                        "User is not admin",
                        data
                    )
                    return False
            else:
                self.log_test(
                    "POST /api/auth/login",
                    "FAIL",
                    f"HTTP {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_test(
                "POST /api/auth/login",
                "FAIL",
                f"Exception: {str(e)}"
            )
            return False

    def test_events_endpoint(self):
        """Test GET /api/events - should return ~200 events"""
        print("📅 Testing Events Endpoint...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/events")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    event_count = len(data)
                    # Check for ObjectId serialization issues
                    has_objectid_issues = False
                    sample_event = data[0] if data else None
                    
                    if sample_event:
                        # Check if IDs are strings (not ObjectId objects)
                        event_id = sample_event.get("id")
                        if not isinstance(event_id, str):
                            has_objectid_issues = True
                    
                    if has_objectid_issues:
                        self.log_test(
                            "GET /api/events",
                            "FAIL",
                            f"ObjectId serialization issue detected. Event ID type: {type(event_id)}",
                            sample_event
                        )
                    else:
                        self.log_test(
                            "GET /api/events",
                            "PASS",
                            f"Retrieved {event_count} events. Expected ~200 (188 base + recurring instances). Sample event ID: {event_id}"
                        )
                else:
                    self.log_test(
                        "GET /api/events",
                        "FAIL",
                        f"Expected list, got {type(data)}",
                        data
                    )
            else:
                self.log_test(
                    "GET /api/events",
                    "FAIL",
                    f"HTTP {response.status_code}",
                    response.text
                )
                
        except Exception as e:
            self.log_test(
                "GET /api/events",
                "FAIL",
                f"Exception: {str(e)}"
            )

    def test_user_cars_endpoint(self):
        """Test GET /api/user-cars/user/{admin_user_id} - should return admin's car data"""
        print("🚗 Testing User Cars Endpoint...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/user-cars/user/{ADMIN_USER_ID}")
            
            if response.status_code == 200:
                data = response.json()
                # Check for ObjectId serialization
                if data and isinstance(data, dict):
                    car_id = data.get("id")
                    if isinstance(car_id, str):
                        self.log_test(
                            f"GET /api/user-cars/user/{ADMIN_USER_ID}",
                            "PASS",
                            f"Retrieved admin's car data. Car ID: {car_id}, Make: {data.get('make')}, Model: {data.get('model')}"
                        )
                    else:
                        self.log_test(
                            f"GET /api/user-cars/user/{ADMIN_USER_ID}",
                            "FAIL",
                            f"ObjectId serialization issue. Car ID type: {type(car_id)}",
                            data
                        )
                elif data is None:
                    self.log_test(
                        f"GET /api/user-cars/user/{ADMIN_USER_ID}",
                        "PASS",
                        "Admin has no car registered (null response is valid)"
                    )
                else:
                    self.log_test(
                        f"GET /api/user-cars/user/{ADMIN_USER_ID}",
                        "FAIL",
                        f"Unexpected response format: {type(data)}",
                        data
                    )
            else:
                self.log_test(
                    f"GET /api/user-cars/user/{ADMIN_USER_ID}",
                    "FAIL",
                    f"HTTP {response.status_code}",
                    response.text
                )
                
        except Exception as e:
            self.log_test(
                f"GET /api/user-cars/user/{ADMIN_USER_ID}",
                "FAIL",
                f"Exception: {str(e)}"
            )

    def test_public_cars_endpoint(self):
        """Test GET /api/user-cars/public - should return 50+ public cars"""
        print("🏎️ Testing Public Cars Endpoint...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/user-cars/public")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    car_count = len(data)
                    # Check ObjectId serialization
                    has_objectid_issues = False
                    sample_car = data[0] if data else None
                    
                    if sample_car:
                        car_id = sample_car.get("id")
                        if not isinstance(car_id, str):
                            has_objectid_issues = True
                    
                    if has_objectid_issues:
                        self.log_test(
                            "GET /api/user-cars/public",
                            "FAIL",
                            f"ObjectId serialization issue. Car ID type: {type(car_id)}",
                            sample_car
                        )
                    else:
                        self.log_test(
                            "GET /api/user-cars/public",
                            "PASS",
                            f"Retrieved {car_count} public cars. Expected 50+. Sample car: {sample_car.get('make') if sample_car else 'None'} {sample_car.get('model') if sample_car else ''}"
                        )
                else:
                    self.log_test(
                        "GET /api/user-cars/public",
                        "FAIL",
                        f"Expected list, got {type(data)}",
                        data
                    )
            else:
                self.log_test(
                    "GET /api/user-cars/public",
                    "FAIL",
                    f"HTTP {response.status_code}",
                    response.text
                )
                
        except Exception as e:
            self.log_test(
                "GET /api/user-cars/public",
                "FAIL",
                f"Exception: {str(e)}"
            )

    def test_clubs_endpoint(self):
        """Test GET /api/clubs - should return ~20 approved clubs"""
        print("🏁 Testing Clubs Endpoint...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/clubs")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    club_count = len(data)
                    # Check ObjectId serialization
                    has_objectid_issues = False
                    sample_club = data[0] if data else None
                    
                    if sample_club:
                        club_id = sample_club.get("id")
                        if not isinstance(club_id, str):
                            has_objectid_issues = True
                    
                    if has_objectid_issues:
                        self.log_test(
                            "GET /api/clubs",
                            "FAIL",
                            f"ObjectId serialization issue. Club ID type: {type(club_id)}",
                            sample_club
                        )
                    else:
                        self.log_test(
                            "GET /api/clubs",
                            "PASS",
                            f"Retrieved {club_count} clubs. Expected ~20. Sample club: {sample_club.get('name') if sample_club else 'None'}"
                        )
                else:
                    self.log_test(
                        "GET /api/clubs",
                        "FAIL",
                        f"Expected list, got {type(data)}",
                        data
                    )
            else:
                self.log_test(
                    "GET /api/clubs",
                    "FAIL",
                    f"HTTP {response.status_code}",
                    response.text
                )
                
        except Exception as e:
            self.log_test(
                "GET /api/clubs",
                "FAIL",
                f"Exception: {str(e)}"
            )

    def test_rsvp_endpoint(self):
        """Test GET /api/rsvp/user/{admin_user_id} - should return RSVPs"""
        print("📝 Testing RSVP Endpoint...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/rsvp/user/{ADMIN_USER_ID}")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    rsvp_count = len(data)
                    # Check ObjectId serialization
                    has_objectid_issues = False
                    sample_rsvp = data[0] if data else None
                    
                    if sample_rsvp:
                        rsvp_id = sample_rsvp.get("id")
                        if not isinstance(rsvp_id, str):
                            has_objectid_issues = True
                    
                    if has_objectid_issues:
                        self.log_test(
                            f"GET /api/rsvp/user/{ADMIN_USER_ID}",
                            "FAIL",
                            f"ObjectId serialization issue. RSVP ID type: {type(rsvp_id)}",
                            sample_rsvp
                        )
                    else:
                        self.log_test(
                            f"GET /api/rsvp/user/{ADMIN_USER_ID}",
                            "PASS",
                            f"Retrieved {rsvp_count} RSVPs for admin user"
                        )
                else:
                    self.log_test(
                        f"GET /api/rsvp/user/{ADMIN_USER_ID}",
                        "FAIL",
                        f"Expected list, got {type(data)}",
                        data
                    )
            else:
                self.log_test(
                    f"GET /api/rsvp/user/{ADMIN_USER_ID}",
                    "FAIL",
                    f"HTTP {response.status_code}",
                    response.text
                )
                
        except Exception as e:
            self.log_test(
                f"GET /api/rsvp/user/{ADMIN_USER_ID}",
                "FAIL",
                f"Exception: {str(e)}"
            )

    def test_notifications_endpoint(self):
        """Test GET /api/notifications/{admin_user_id} - should return notifications"""
        print("🔔 Testing Notifications Endpoint...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/notifications/{ADMIN_USER_ID}")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    notification_count = len(data)
                    # Check ObjectId serialization
                    has_objectid_issues = False
                    sample_notification = data[0] if data else None
                    
                    if sample_notification:
                        notification_id = sample_notification.get("id")
                        if not isinstance(notification_id, str):
                            has_objectid_issues = True
                    
                    if has_objectid_issues:
                        self.log_test(
                            f"GET /api/notifications/{ADMIN_USER_ID}",
                            "FAIL",
                            f"ObjectId serialization issue. Notification ID type: {type(notification_id)}",
                            sample_notification
                        )
                    else:
                        self.log_test(
                            f"GET /api/notifications/{ADMIN_USER_ID}",
                            "PASS",
                            f"Retrieved {notification_count} notifications for admin user"
                        )
                else:
                    self.log_test(
                        f"GET /api/notifications/{ADMIN_USER_ID}",
                        "FAIL",
                        f"Expected list, got {type(data)}",
                        data
                    )
            else:
                self.log_test(
                    f"GET /api/notifications/{ADMIN_USER_ID}",
                    "FAIL",
                    f"HTTP {response.status_code}",
                    response.text
                )
                
        except Exception as e:
            self.log_test(
                f"GET /api/notifications/{ADMIN_USER_ID}",
                "FAIL",
                f"Exception: {str(e)}"
            )

    def test_performance_runs_endpoint(self):
        """Test GET /api/performance-runs/user/{admin_user_id} - should return runs"""
        print("🏁 Testing Performance Runs Endpoint...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/performance-runs/user/{ADMIN_USER_ID}")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    runs_count = len(data)
                    # Check ObjectId serialization
                    has_objectid_issues = False
                    sample_run = data[0] if data else None
                    
                    if sample_run:
                        run_id = sample_run.get("id")
                        if not isinstance(run_id, str):
                            has_objectid_issues = True
                    
                    if has_objectid_issues:
                        self.log_test(
                            f"GET /api/performance-runs/user/{ADMIN_USER_ID}",
                            "FAIL",
                            f"ObjectId serialization issue. Run ID type: {type(run_id)}",
                            sample_run
                        )
                    else:
                        self.log_test(
                            f"GET /api/performance-runs/user/{ADMIN_USER_ID}",
                            "PASS",
                            f"Retrieved {runs_count} performance runs for admin user"
                        )
                else:
                    self.log_test(
                        f"GET /api/performance-runs/user/{ADMIN_USER_ID}",
                        "FAIL",
                        f"Expected list, got {type(data)}",
                        data
                    )
            else:
                self.log_test(
                    f"GET /api/performance-runs/user/{ADMIN_USER_ID}",
                    "FAIL",
                    f"HTTP {response.status_code}",
                    response.text
                )
                
        except Exception as e:
            self.log_test(
                f"GET /api/performance-runs/user/{ADMIN_USER_ID}",
                "FAIL",
                f"Exception: {str(e)}"
            )

    def test_feedback_endpoint(self):
        """Test GET /api/feedback/user/{admin_user_id} - should return feedback items"""
        print("💬 Testing Feedback Endpoint...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/feedback/user/{ADMIN_USER_ID}")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    feedback_count = len(data)
                    # Check ObjectId serialization
                    has_objectid_issues = False
                    sample_feedback = data[0] if data else None
                    
                    if sample_feedback:
                        feedback_id = sample_feedback.get("id")
                        if not isinstance(feedback_id, str):
                            has_objectid_issues = True
                    
                    if has_objectid_issues:
                        self.log_test(
                            f"GET /api/feedback/user/{ADMIN_USER_ID}",
                            "FAIL",
                            f"ObjectId serialization issue. Feedback ID type: {type(feedback_id)}",
                            sample_feedback
                        )
                    else:
                        self.log_test(
                            f"GET /api/feedback/user/{ADMIN_USER_ID}",
                            "PASS",
                            f"Retrieved {feedback_count} feedback items for admin user"
                        )
                else:
                    self.log_test(
                        f"GET /api/feedback/user/{ADMIN_USER_ID}",
                        "FAIL",
                        f"Expected list, got {type(data)}",
                        data
                    )
            else:
                self.log_test(
                    f"GET /api/feedback/user/{ADMIN_USER_ID}",
                    "FAIL",
                    f"HTTP {response.status_code}",
                    response.text
                )
                
        except Exception as e:
            self.log_test(
                f"GET /api/feedback/user/{ADMIN_USER_ID}",
                "FAIL",
                f"Exception: {str(e)}"
            )

    def test_comments_endpoint(self):
        """Test GET /api/comments/event/{event_id} - should return comments or empty array"""
        print("💭 Testing Comments Endpoint...")
        
        # First get an event ID from the events endpoint
        try:
            events_response = self.session.get(f"{BACKEND_URL}/events")
            if events_response.status_code == 200:
                events = events_response.json()
                if events and len(events) > 0:
                    event_id = events[0].get("id")
                    if not event_id:
                        self.log_test(
                            "GET /api/comments/event/{event_id}",
                            "FAIL",
                            "Could not get event ID from events endpoint"
                        )
                        return
                else:
                    # Use the specific event ID from review request
                    event_id = "69bc81ee27b3bd28c27522fe"
            else:
                # Use the specific event ID from review request
                event_id = "69bc81ee27b3bd28c27522fe"
            
            response = self.session.get(f"{BACKEND_URL}/comments/event/{event_id}")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    comments_count = len(data)
                    # Check ObjectId serialization
                    has_objectid_issues = False
                    sample_comment = data[0] if data else None
                    
                    if sample_comment:
                        comment_id = sample_comment.get("id")
                        if not isinstance(comment_id, str):
                            has_objectid_issues = True
                    
                    if has_objectid_issues:
                        self.log_test(
                            f"GET /api/comments/event/{event_id}",
                            "FAIL",
                            f"ObjectId serialization issue. Comment ID type: {type(comment_id)}",
                            sample_comment
                        )
                    else:
                        self.log_test(
                            f"GET /api/comments/event/{event_id}",
                            "PASS",
                            f"Retrieved {comments_count} comments for event {event_id}"
                        )
                else:
                    self.log_test(
                        f"GET /api/comments/event/{event_id}",
                        "FAIL",
                        f"Expected list, got {type(data)}",
                        data
                    )
            else:
                self.log_test(
                    f"GET /api/comments/event/{event_id}",
                    "FAIL",
                    f"HTTP {response.status_code}",
                    response.text
                )
                
        except Exception as e:
            self.log_test(
                "GET /api/comments/event/{event_id}",
                "FAIL",
                f"Exception: {str(e)}"
            )

    def test_conversations_endpoint(self):
        """Test GET /api/messages/conversations/{admin_user_id} - should return conversations"""
        print("💬 Testing Conversations Endpoint...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/messages/conversations/{ADMIN_USER_ID}")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    conversations_count = len(data)
                    # Check ObjectId serialization
                    has_objectid_issues = False
                    sample_conversation = data[0] if data else None
                    
                    if sample_conversation:
                        partner_id = sample_conversation.get("partnerId")
                        if not isinstance(partner_id, str):
                            has_objectid_issues = True
                    
                    if has_objectid_issues:
                        self.log_test(
                            f"GET /api/messages/conversations/{ADMIN_USER_ID}",
                            "FAIL",
                            f"ObjectId serialization issue. Partner ID type: {type(partner_id)}",
                            sample_conversation
                        )
                    else:
                        self.log_test(
                            f"GET /api/messages/conversations/{ADMIN_USER_ID}",
                            "PASS",
                            f"Retrieved {conversations_count} conversations for admin user"
                        )
                else:
                    self.log_test(
                        f"GET /api/messages/conversations/{ADMIN_USER_ID}",
                        "FAIL",
                        f"Expected list, got {type(data)}",
                        data
                    )
            else:
                self.log_test(
                    f"GET /api/messages/conversations/{ADMIN_USER_ID}",
                    "FAIL",
                    f"HTTP {response.status_code}",
                    response.text
                )
                
        except Exception as e:
            self.log_test(
                f"GET /api/messages/conversations/{ADMIN_USER_ID}",
                "FAIL",
                f"Exception: {str(e)}"
            )

    def test_leaderboard_endpoint(self):
        """Test GET /api/leaderboard/0-60 - should return leaderboard entries"""
        print("🏆 Testing Leaderboard Endpoint...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/leaderboard/0-60")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    leaderboard_count = len(data)
                    # Check ObjectId serialization
                    has_objectid_issues = False
                    sample_entry = data[0] if data else None
                    
                    if sample_entry:
                        entry_id = sample_entry.get("id")
                        if not isinstance(entry_id, str):
                            has_objectid_issues = True
                    
                    if has_objectid_issues:
                        self.log_test(
                            "GET /api/leaderboard/0-60",
                            "FAIL",
                            f"ObjectId serialization issue. Entry ID type: {type(entry_id)}",
                            sample_entry
                        )
                    else:
                        self.log_test(
                            "GET /api/leaderboard/0-60",
                            "PASS",
                            f"Retrieved {leaderboard_count} leaderboard entries for 0-60"
                        )
                else:
                    self.log_test(
                        "GET /api/leaderboard/0-60",
                        "FAIL",
                        f"Expected list, got {type(data)}",
                        data
                    )
            else:
                self.log_test(
                    "GET /api/leaderboard/0-60",
                    "FAIL",
                    f"HTTP {response.status_code}",
                    response.text
                )
                
        except Exception as e:
            self.log_test(
                "GET /api/leaderboard/0-60",
                "FAIL",
                f"Exception: {str(e)}"
            )

    def run_all_tests(self):
        """Run all production data tests"""
        print("🚀 Starting Oklahoma Car Events Production Data Testing")
        print("=" * 60)
        
        # Test admin login first
        if not self.test_admin_login():
            print("❌ Admin login failed. Cannot proceed with other tests.")
            return False
        
        # Run all endpoint tests
        self.test_events_endpoint()
        self.test_user_cars_endpoint()
        self.test_public_cars_endpoint()
        self.test_clubs_endpoint()
        self.test_rsvp_endpoint()
        self.test_notifications_endpoint()
        self.test_performance_runs_endpoint()
        self.test_feedback_endpoint()
        self.test_comments_endpoint()
        self.test_conversations_endpoint()
        self.test_leaderboard_endpoint()
        
        # Summary
        print("=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r["status"] == "PASS"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if result["status"] == "FAIL":
                    print(f"  - {result['endpoint']}: {result['details']}")
        
        return failed_tests == 0

if __name__ == "__main__":
    tester = ProductionDataTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)