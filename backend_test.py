#!/usr/bin/env python3
"""
Comprehensive backend API testing for Oklahoma Car Events
Tests all endpoints mentioned in the review request
"""

import requests
import json
from datetime import datetime, timedelta
import sys

# Use the production URL from the environment
BASE_URL = "https://drive-okc.preview.emergentagent.com/api"

class APITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.test_results = []
        self.test_user_id = None
        self.test_event_id = None
        self.test_event_ids = []
        
    def log_result(self, test_name, success, status_code, response_data, error=None):
        """Log test results"""
        result = {
            'test': test_name,
            'success': success,
            'status_code': status_code,
            'response': response_data,
            'error': str(error) if error else None
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name} - Status: {status_code}")
        if error:
            print(f"   Error: {error}")
        print()

    def test_welcome_endpoint(self):
        """Test GET /api/ - Welcome message"""
        try:
            response = requests.get(f"{self.base_url}/")
            success = response.status_code == 200 and "Oklahoma Car Events API" in response.text
            self.log_result("Welcome Endpoint", success, response.status_code, response.json())
        except Exception as e:
            self.log_result("Welcome Endpoint", False, 0, {}, e)

    def test_get_events(self):
        """Test GET /api/events - Get all events"""
        try:
            response = requests.get(f"{self.base_url}/events")
            success = response.status_code == 200
            data = response.json() if success else {}
            
            # Store event IDs for later tests
            if success and isinstance(data, list) and len(data) > 0:
                self.test_event_ids = [event.get('id') for event in data if event.get('id')]
                if self.test_event_ids:
                    self.test_event_id = self.test_event_ids[0]
            
            self.log_result("Get All Events", success, response.status_code, data)
        except Exception as e:
            self.log_result("Get All Events", False, 0, {}, e)

    def test_filter_events_by_city(self):
        """Test GET /api/events?city=Oklahoma City - Filter by city"""
        try:
            response = requests.get(f"{self.base_url}/events", params={"city": "Oklahoma City"})
            success = response.status_code == 200
            data = response.json() if success else {}
            self.log_result("Filter Events by City", success, response.status_code, data)
        except Exception as e:
            self.log_result("Filter Events by City", False, 0, {}, e)

    def test_filter_events_by_type(self):
        """Test GET /api/events?eventType=Car Show - Filter by event type"""
        try:
            response = requests.get(f"{self.base_url}/events", params={"eventType": "Car Show"})
            success = response.status_code == 200
            data = response.json() if success else {}
            self.log_result("Filter Events by Type", success, response.status_code, data)
        except Exception as e:
            self.log_result("Filter Events by Type", False, 0, {}, e)

    def test_search_events(self):
        """Test GET /api/events?search=muscle - Search functionality"""
        try:
            response = requests.get(f"{self.base_url}/events", params={"search": "muscle"})
            success = response.status_code == 200
            data = response.json() if success else {}
            self.log_result("Search Events", success, response.status_code, data)
        except Exception as e:
            self.log_result("Search Events", False, 0, {}, e)

    def test_get_specific_event(self):
        """Test GET /api/events/{event_id} - Get specific event"""
        if not self.test_event_id:
            self.log_result("Get Specific Event", False, 0, {}, "No event ID available from previous tests")
            return
            
        try:
            response = requests.get(f"{self.base_url}/events/{self.test_event_id}")
            success = response.status_code == 200
            data = response.json() if success else {}
            self.log_result("Get Specific Event", success, response.status_code, data)
        except Exception as e:
            self.log_result("Get Specific Event", False, 0, {}, e)

    def test_create_event(self):
        """Test POST /api/events - Create new event"""
        event_data = {
            "title": "Test Car Meet - Classic Muscle Cars",
            "description": "A gathering for classic muscle car enthusiasts to showcase their vehicles",
            "date": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
            "time": "18:00",
            "location": "Bricktown District",
            "address": "123 Bricktown Ave",
            "city": "Oklahoma City",
            "latitude": 35.4676,
            "longitude": -97.5164,
            "organizer": "Test Organizer",
            "entryFee": "Free",
            "carTypes": ["Muscle Cars", "Classic Cars"],
            "eventType": "Car Meet",
            "contactInfo": "test@example.com",
            "website": "https://testcarclub.com"
        }
        
        try:
            response = requests.post(f"{self.base_url}/events", json=event_data)
            success = response.status_code == 200
            data = response.json() if success else {}
            
            # Store the created event ID for update/delete tests
            if success and data.get('id'):
                self.test_event_id = data['id']
                self.test_event_ids.append(data['id'])
            
            self.log_result("Create Event", success, response.status_code, data)
        except Exception as e:
            self.log_result("Create Event", False, 0, {}, e)

    def test_update_event(self):
        """Test PUT /api/events/{event_id} - Update event"""
        if not self.test_event_id:
            self.log_result("Update Event", False, 0, {}, "No event ID available")
            return
            
        update_data = {
            "title": "Updated Test Car Meet - Modified",
            "description": "Updated description for the car meet",
            "entryFee": "$5"
        }
        
        try:
            response = requests.put(f"{self.base_url}/events/{self.test_event_id}", json=update_data)
            success = response.status_code == 200
            data = response.json() if success else {}
            self.log_result("Update Event", success, response.status_code, data)
        except Exception as e:
            self.log_result("Update Event", False, 0, {}, e)

    def test_register_user(self):
        """Test POST /api/auth/register - Register new user"""
        user_data = {
            "email": f"testuser_{datetime.now().strftime('%Y%m%d_%H%M%S')}@example.com",
            "name": "Test User",
            "password": "testpassword123",
            "profilePic": "https://example.com/profile.jpg"
        }
        
        try:
            response = requests.post(f"{self.base_url}/auth/register", json=user_data)
            success = response.status_code == 200
            data = response.json() if success else {}
            
            # Store user ID for other tests
            if success and data.get('id'):
                self.test_user_id = data['id']
            
            self.log_result("Register User", success, response.status_code, data)
        except Exception as e:
            self.log_result("Register User", False, 0, {}, e)

    def test_login_user(self):
        """Test POST /api/auth/login - Login user"""
        # First register a user for login test
        login_email = f"logintest_{datetime.now().strftime('%Y%m%d_%H%M%S')}@example.com"
        register_data = {
            "email": login_email,
            "name": "Login Test User", 
            "password": "logintest123"
        }
        
        try:
            # Register the user first
            register_response = requests.post(f"{self.base_url}/auth/register", json=register_data)
            if register_response.status_code != 200:
                self.log_result("Login User", False, register_response.status_code, {}, "Failed to register user for login test")
                return
            
            # Now test login
            login_data = {
                "email": login_email,
                "password": "logintest123"
            }
            
            response = requests.post(f"{self.base_url}/auth/login", json=login_data)
            success = response.status_code == 200
            data = response.json() if success else {}
            
            # Store user ID if we don't have one
            if success and data.get('id') and not self.test_user_id:
                self.test_user_id = data['id']
            
            self.log_result("Login User", success, response.status_code, data)
        except Exception as e:
            self.log_result("Login User", False, 0, {}, e)

    def test_add_favorite(self):
        """Test POST /api/favorites - Add favorite"""
        if not self.test_user_id or not self.test_event_id:
            self.log_result("Add Favorite", False, 0, {}, "Missing user ID or event ID")
            return
            
        favorite_data = {
            "userId": self.test_user_id,
            "eventId": self.test_event_id
        }
        
        try:
            response = requests.post(f"{self.base_url}/favorites", json=favorite_data)
            success = response.status_code == 200
            data = response.json() if success else {}
            self.log_result("Add Favorite", success, response.status_code, data)
        except Exception as e:
            self.log_result("Add Favorite", False, 0, {}, e)

    def test_get_user_favorites(self):
        """Test GET /api/favorites/user/{user_id} - Get user favorites"""
        if not self.test_user_id:
            self.log_result("Get User Favorites", False, 0, {}, "Missing user ID")
            return
            
        try:
            response = requests.get(f"{self.base_url}/favorites/user/{self.test_user_id}")
            success = response.status_code == 200
            data = response.json() if success else {}
            self.log_result("Get User Favorites", success, response.status_code, data)
        except Exception as e:
            self.log_result("Get User Favorites", False, 0, {}, e)

    def test_remove_favorite(self):
        """Test DELETE /api/favorites/{user_id}/{event_id} - Remove favorite"""
        if not self.test_user_id or not self.test_event_id:
            self.log_result("Remove Favorite", False, 0, {}, "Missing user ID or event ID")
            return
            
        try:
            response = requests.delete(f"{self.base_url}/favorites/{self.test_user_id}/{self.test_event_id}")
            success = response.status_code == 200
            data = response.json() if success else {}
            self.log_result("Remove Favorite", success, response.status_code, data)
        except Exception as e:
            self.log_result("Remove Favorite", False, 0, {}, e)

    def test_create_rsvp(self):
        """Test POST /api/rsvps - Create RSVP"""
        if not self.test_user_id or not self.test_event_id:
            self.log_result("Create RSVP", False, 0, {}, "Missing user ID or event ID")
            return
            
        rsvp_data = {
            "userId": self.test_user_id,
            "eventId": self.test_event_id,
            "status": "going"
        }
        
        try:
            response = requests.post(f"{self.base_url}/rsvps", json=rsvp_data)
            success = response.status_code == 200
            data = response.json() if success else {}
            self.log_result("Create RSVP", success, response.status_code, data)
        except Exception as e:
            self.log_result("Create RSVP", False, 0, {}, e)

    def test_get_user_rsvps(self):
        """Test GET /api/rsvps/user/{user_id} - Get user RSVPs"""
        if not self.test_user_id:
            self.log_result("Get User RSVPs", False, 0, {}, "Missing user ID")
            return
            
        try:
            response = requests.get(f"{self.base_url}/rsvps/user/{self.test_user_id}")
            success = response.status_code == 200
            data = response.json() if success else {}
            self.log_result("Get User RSVPs", success, response.status_code, data)
        except Exception as e:
            self.log_result("Get User RSVPs", False, 0, {}, e)

    def test_create_comment(self):
        """Test POST /api/comments - Create comment"""
        if not self.test_user_id or not self.test_event_id:
            self.log_result("Create Comment", False, 0, {}, "Missing user ID or event ID")
            return
            
        comment_data = {
            "eventId": self.test_event_id,
            "userId": self.test_user_id,
            "userName": "Test User",
            "text": "Great event! Looking forward to attending.",
            "rating": 5
        }
        
        try:
            response = requests.post(f"{self.base_url}/comments", json=comment_data)
            success = response.status_code == 200
            data = response.json() if success else {}
            self.log_result("Create Comment", success, response.status_code, data)
        except Exception as e:
            self.log_result("Create Comment", False, 0, {}, e)

    def test_get_event_comments(self):
        """Test GET /api/comments/event/{event_id} - Get event comments"""
        if not self.test_event_id:
            self.log_result("Get Event Comments", False, 0, {}, "Missing event ID")
            return
            
        try:
            response = requests.get(f"{self.base_url}/comments/event/{self.test_event_id}")
            success = response.status_code == 200
            data = response.json() if success else {}
            self.log_result("Get Event Comments", success, response.status_code, data)
        except Exception as e:
            self.log_result("Get Event Comments", False, 0, {}, e)

    def test_delete_event(self):
        """Test DELETE /api/events/{event_id} - Delete event"""
        if not self.test_event_id:
            self.log_result("Delete Event", False, 0, {}, "No event ID available")
            return
            
        try:
            response = requests.delete(f"{self.base_url}/events/{self.test_event_id}")
            success = response.status_code == 200
            data = response.json() if success else {}
            self.log_result("Delete Event", success, response.status_code, data)
        except Exception as e:
            self.log_result("Delete Event", False, 0, {}, e)

    # ==============================================
    # GPS PERFORMANCE TIMER ENDPOINTS TESTS
    # ==============================================

    def test_create_performance_run(self):
        """Test POST /api/performance-runs - Create performance run"""
        if not self.test_user_id:
            self.log_result("Create Performance Run", False, 0, {}, "Missing user ID")
            return
            
        performance_data = {
            "userId": self.test_user_id,
            "carInfo": "2015 Ford Mustang GT 5.0L V8",
            "zeroToSixty": 4.5,
            "zeroToHundred": 9.2,
            "quarterMile": 12.3,
            "location": "Thunder Valley Raceway Park",
            "latitude": 35.4676,
            "longitude": -97.5164
        }
        
        try:
            response = requests.post(f"{self.base_url}/performance-runs", json=performance_data)
            success = response.status_code == 200
            data = response.json() if success else {}
            
            # Validate response structure
            if success and data:
                required_fields = ['id', 'userId', 'carInfo', 'createdAt']
                missing_fields = [field for field in required_fields if field not in data]
                if missing_fields:
                    success = False
                    error = f"Missing required fields: {missing_fields}"
                    self.log_result("Create Performance Run", success, response.status_code, data, error)
                else:
                    # Validate performance data
                    if (data.get('zeroToSixty') != 4.5 or 
                        data.get('zeroToHundred') != 9.2 or 
                        data.get('quarterMile') != 12.3):
                        self.log_result("Create Performance Run", False, response.status_code, data, "Performance times not correctly stored")
                    else:
                        self.log_result("Create Performance Run", success, response.status_code, data)
            else:
                self.log_result("Create Performance Run", success, response.status_code, data)
        except Exception as e:
            self.log_result("Create Performance Run", False, 0, {}, e)

    def test_create_additional_performance_runs(self):
        """Create additional performance runs to populate leaderboards"""
        if not self.test_user_id:
            return
            
        additional_runs = [
            {
                "userId": self.test_user_id,
                "carInfo": "2018 Dodge Challenger SRT Hellcat",
                "zeroToSixty": 3.6,
                "zeroToHundred": 7.9,
                "quarterMile": 11.2,
                "location": "Hallett Motor Racing Circuit"
            },
            {
                "userId": self.test_user_id,
                "carInfo": "2020 Chevrolet Camaro SS",
                "zeroToSixty": 4.0,
                "zeroToHundred": 8.5,
                "quarterMile": 12.0,
                "location": "Motorsport Park Hastings"
            },
            {
                "userId": self.test_user_id,
                "carInfo": "2017 BMW M3",
                "zeroToSixty": 3.9,
                "location": "Oklahoma City Street Test"
            }
        ]
        
        for i, run_data in enumerate(additional_runs):
            try:
                requests.post(f"{self.base_url}/performance-runs", json=run_data)
            except:
                pass  # Continue even if some fail

    def test_get_zero_to_sixty_leaderboard(self):
        """Test GET /api/leaderboard/0-60 - Get 0-60 MPH leaderboard"""
        try:
            response = requests.get(f"{self.base_url}/leaderboard/0-60")
            success = response.status_code == 200
            data = response.json() if success else {}
            
            if success and isinstance(data, list):
                # Validate sorting (should be ascending - fastest times first)
                if len(data) > 1:
                    times = [entry.get('time') for entry in data if entry.get('time')]
                    if times != sorted(times):
                        success = False
                        error = "Leaderboard not properly sorted by time (ascending)"
                        self.log_result("0-60 Leaderboard", success, response.status_code, data, error)
                        return
                
                # Validate response structure
                if data:
                    required_fields = ['id', 'userId', 'userName', 'carInfo', 'time', 'createdAt']
                    first_entry = data[0]
                    missing_fields = [field for field in required_fields if field not in first_entry]
                    if missing_fields:
                        success = False
                        error = f"Missing required fields in leaderboard entry: {missing_fields}"
                        self.log_result("0-60 Leaderboard", success, response.status_code, data, error)
                        return
                
                self.log_result("0-60 Leaderboard", success, response.status_code, data)
            else:
                self.log_result("0-60 Leaderboard", success, response.status_code, data)
        except Exception as e:
            self.log_result("0-60 Leaderboard", False, 0, {}, e)

    def test_get_zero_to_hundred_leaderboard(self):
        """Test GET /api/leaderboard/0-100 - Get 0-100 MPH leaderboard"""
        try:
            response = requests.get(f"{self.base_url}/leaderboard/0-100")
            success = response.status_code == 200
            data = response.json() if success else {}
            
            if success and isinstance(data, list):
                # Validate sorting (should be ascending - fastest times first)
                if len(data) > 1:
                    times = [entry.get('time') for entry in data if entry.get('time')]
                    if times != sorted(times):
                        success = False
                        error = "Leaderboard not properly sorted by time (ascending)"
                        self.log_result("0-100 Leaderboard", success, response.status_code, data, error)
                        return
                
                # Validate response structure
                if data:
                    required_fields = ['id', 'userId', 'userName', 'carInfo', 'time', 'createdAt']
                    first_entry = data[0]
                    missing_fields = [field for field in required_fields if field not in first_entry]
                    if missing_fields:
                        success = False
                        error = f"Missing required fields in leaderboard entry: {missing_fields}"
                        self.log_result("0-100 Leaderboard", success, response.status_code, data, error)
                        return
                
                self.log_result("0-100 Leaderboard", success, response.status_code, data)
            else:
                self.log_result("0-100 Leaderboard", success, response.status_code, data)
        except Exception as e:
            self.log_result("0-100 Leaderboard", False, 0, {}, e)

    def test_get_quarter_mile_leaderboard(self):
        """Test GET /api/leaderboard/quarter-mile - Get quarter mile leaderboard"""
        try:
            response = requests.get(f"{self.base_url}/leaderboard/quarter-mile")
            success = response.status_code == 200
            data = response.json() if success else {}
            
            if success and isinstance(data, list):
                # Validate sorting (should be ascending - fastest times first)
                if len(data) > 1:
                    times = [entry.get('time') for entry in data if entry.get('time')]
                    if times != sorted(times):
                        success = False
                        error = "Leaderboard not properly sorted by time (ascending)"
                        self.log_result("Quarter Mile Leaderboard", success, response.status_code, data, error)
                        return
                
                # Validate response structure
                if data:
                    required_fields = ['id', 'userId', 'userName', 'carInfo', 'time', 'createdAt']
                    first_entry = data[0]
                    missing_fields = [field for field in required_fields if field not in first_entry]
                    if missing_fields:
                        success = False
                        error = f"Missing required fields in leaderboard entry: {missing_fields}"
                        self.log_result("Quarter Mile Leaderboard", success, response.status_code, data, error)
                        return
                
                self.log_result("Quarter Mile Leaderboard", success, response.status_code, data)
            else:
                self.log_result("Quarter Mile Leaderboard", success, response.status_code, data)
        except Exception as e:
            self.log_result("Quarter Mile Leaderboard", False, 0, {}, e)

    def test_get_user_performance_runs(self):
        """Test GET /api/performance-runs/user/{user_id} - Get user's run history"""
        if not self.test_user_id:
            self.log_result("User Performance Runs", False, 0, {}, "Missing user ID")
            return
            
        try:
            response = requests.get(f"{self.base_url}/performance-runs/user/{self.test_user_id}")
            success = response.status_code == 200
            data = response.json() if success else {}
            
            if success and isinstance(data, list):
                # Should be sorted by createdAt descending (newest first)
                if len(data) > 1:
                    # Parse dates and check if sorted in descending order
                    try:
                        dates = [datetime.fromisoformat(entry['createdAt'].replace('Z', '+00:00')) 
                                for entry in data if entry.get('createdAt')]
                        if dates != sorted(dates, reverse=True):
                            success = False
                            error = "User runs not properly sorted by creation date (newest first)"
                            self.log_result("User Performance Runs", success, response.status_code, data, error)
                            return
                    except:
                        # If date parsing fails, continue with basic validation
                        pass
                
                # Validate response structure
                if data:
                    required_fields = ['id', 'userId', 'carInfo', 'createdAt']
                    first_entry = data[0]
                    missing_fields = [field for field in required_fields if field not in first_entry]
                    if missing_fields:
                        success = False
                        error = f"Missing required fields in user run entry: {missing_fields}"
                        self.log_result("User Performance Runs", success, response.status_code, data, error)
                        return
                    
                    # Verify all entries belong to the correct user
                    wrong_user_entries = [entry for entry in data if entry.get('userId') != self.test_user_id]
                    if wrong_user_entries:
                        success = False
                        error = "Response contains runs from other users"
                        self.log_result("User Performance Runs", success, response.status_code, data, error)
                        return
                
                self.log_result("User Performance Runs", success, response.status_code, data)
            else:
                self.log_result("User Performance Runs", success, response.status_code, data)
        except Exception as e:
            self.log_result("User Performance Runs", False, 0, {}, e)

    def run_all_tests(self):
        """Run all API tests in sequence"""
        print(f"🚀 Starting Oklahoma Car Events API Testing")
        print(f"📡 Base URL: {self.base_url}")
        print("=" * 80)
        print()
        
        # Basic endpoint tests
        self.test_welcome_endpoint()
        self.test_get_events()
        self.test_filter_events_by_city()
        self.test_filter_events_by_type()
        self.test_search_events()
        self.test_get_specific_event()
        
        # CRUD operations
        self.test_create_event()
        self.test_update_event()
        
        # Auth tests
        self.test_register_user()
        self.test_login_user()
        
        # Favorites tests
        self.test_add_favorite()
        self.test_get_user_favorites()
        self.test_remove_favorite()
        
        # RSVP tests
        self.test_create_rsvp()
        self.test_get_user_rsvps()
        
        # Comments tests
        self.test_create_comment()
        self.test_get_event_comments()
        
        # ===== GPS PERFORMANCE TIMER TESTS =====
        print("🏁 Starting GPS Performance Timer Tests")
        print("-" * 50)
        
        # Performance runs tests
        self.test_create_performance_run()
        self.test_create_additional_performance_runs()  # Create additional data for leaderboards
        
        # Leaderboard tests
        self.test_get_zero_to_sixty_leaderboard()
        self.test_get_zero_to_hundred_leaderboard()
        self.test_get_quarter_mile_leaderboard()
        
        # User performance history
        self.test_get_user_performance_runs()
        
        print("🏁 Completed GPS Performance Timer Tests")
        print("-" * 50)
        print()
        
        # Cleanup - delete test event
        self.test_delete_event()
        
        # Print summary
        print("=" * 80)
        self.print_summary()

    def print_summary(self):
        """Print test results summary"""
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"📊 TEST RESULTS SUMMARY")
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        print()
        
        if failed_tests > 0:
            print("🔴 FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"   - {result['test']} (Status: {result['status_code']})")
                    if result['error']:
                        print(f"     Error: {result['error']}")
            print()
        
        print("🟢 PASSED TESTS:")
        for result in self.test_results:
            if result['success']:
                print(f"   - {result['test']}")

if __name__ == "__main__":
    tester = APITester()
    tester.run_all_tests()