#!/usr/bin/env python3
"""
Multi-Car Garage Backend Testing Script
Tests the multi-car garage functionality as specified in the review request.
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BACKEND_URL = "https://event-hub-okc-1.preview.emergentagent.com"
ADMIN_EMAIL = "admin@okcarevents.com"
ADMIN_PASSWORD = "admin123"
ADMIN_USER_ID = "69bb035fb5d3f5e057f073ca"

class MultiCarGarageTest:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
        
    def make_request(self, method, endpoint, **kwargs):
        """Make HTTP request with error handling"""
        url = f"{BACKEND_URL}/api{endpoint}"
        try:
            response = self.session.request(method, url, **kwargs)
            return response
        except Exception as e:
            print(f"Request failed: {e}")
            return None
            
    def test_admin_login(self):
        """Test 1: Login as admin to confirm auth works"""
        print("\n=== Test 1: Admin Authentication ===")
        
        response = self.make_request("POST", "/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response and response.status_code == 200:
            data = response.json()
            if data.get("isAdmin") == True:
                self.admin_token = data.get("id")  # Using user ID as token
                self.log_test("Admin Login", True, f"Admin user authenticated successfully. User ID: {self.admin_token}")
                return True
            else:
                self.log_test("Admin Login", False, "User is not admin")
                return False
        else:
            error_msg = response.json().get("detail", "Unknown error") if response else "No response"
            self.log_test("Admin Login", False, f"Login failed: {error_msg}")
            return False
            
    def test_get_user_cars_all(self):
        """Test 2: GET /api/user-cars/user/{user_id}/all - verify returns array with car(s)"""
        print("\n=== Test 2: Get All User Cars ===")
        
        response = self.make_request("GET", f"/user-cars/user/{ADMIN_USER_ID}/all")
        
        if response and response.status_code == 200:
            cars = response.json()
            if isinstance(cars, list):
                car_count = len(cars)
                self.log_test("Get All User Cars", True, f"Retrieved {car_count} cars")
                
                # Verify each car has required fields
                for i, car in enumerate(cars):
                    has_thumbnail = "thumbnailUrl" in car
                    has_active = "isActive" in car
                    if has_thumbnail and has_active:
                        self.log_test(f"Car {i+1} Fields Check", True, f"Car has thumbnailUrl and isActive fields")
                    else:
                        self.log_test(f"Car {i+1} Fields Check", False, f"Missing fields - thumbnailUrl: {has_thumbnail}, isActive: {has_active}")
                
                return cars
            else:
                self.log_test("Get All User Cars", False, "Response is not an array")
                return []
        else:
            error_msg = response.json().get("detail", "Unknown error") if response else "No response"
            self.log_test("Get All User Cars", False, f"Request failed: {error_msg}")
            return []
            
    def test_create_second_car(self):
        """Test 3: POST /api/user-cars/create-or-update-metadata - create a 2nd car"""
        print("\n=== Test 3: Create Second Car ===")
        
        car_data = {
            "userId": ADMIN_USER_ID,
            "make": "Toyota",
            "model": "Supra",
            "year": "2023",
            "color": "White",
            "isPublic": True,
            "description": "Test car"
        }
        
        response = self.make_request("POST", "/user-cars/create-or-update-metadata", json=car_data)
        
        if response and response.status_code == 200:
            car = response.json()
            car_id = car.get("id")
            is_active = car.get("isActive", True)
            
            if car_id:
                self.log_test("Create Second Car", True, f"Created car with ID: {car_id}, isActive: {is_active}")
                return car_id
            else:
                self.log_test("Create Second Car", False, "No car ID returned")
                return None
        else:
            error_msg = response.json().get("detail", "Unknown error") if response else "No response"
            self.log_test("Create Second Car", False, f"Request failed: {error_msg}")
            return None
            
    def test_verify_two_cars(self):
        """Test 4: GET /api/user-cars/user/{user_id}/all - should now return 2 cars"""
        print("\n=== Test 4: Verify Two Cars ===")
        
        response = self.make_request("GET", f"/user-cars/user/{ADMIN_USER_ID}/all")
        
        if response and response.status_code == 200:
            cars = response.json()
            car_count = len(cars)
            
            if car_count == 2:
                self.log_test("Verify Two Cars", True, f"User now has {car_count} cars")
                
                # Check active status
                active_cars = [car for car in cars if car.get("isActive", False)]
                inactive_cars = [car for car in cars if not car.get("isActive", True)]
                
                self.log_test("Active Car Count", len(active_cars) == 1, f"Active cars: {len(active_cars)}, Inactive cars: {len(inactive_cars)}")
                return cars
            else:
                self.log_test("Verify Two Cars", False, f"Expected 2 cars, got {car_count}")
                return cars
        else:
            error_msg = response.json().get("detail", "Unknown error") if response else "No response"
            self.log_test("Verify Two Cars", False, f"Request failed: {error_msg}")
            return []
            
    def test_set_active_car(self, car_id):
        """Test 5: PUT /api/user-cars/{car_id}/set-active - toggle the new car as active"""
        print("\n=== Test 5: Set Active Car ===")
        
        response = self.make_request("PUT", f"/user-cars/{car_id}/set-active")
        
        if response and response.status_code == 200:
            data = response.json()
            self.log_test("Set Active Car", True, f"Car {car_id} set as active: {data.get('message')}")
            return True
        else:
            error_msg = response.json().get("detail", "Unknown error") if response else "No response"
            self.log_test("Set Active Car", False, f"Request failed: {error_msg}")
            return False
            
    def test_verify_active_switch(self):
        """Test 6: Verify first car is now inactive"""
        print("\n=== Test 6: Verify Active Car Switch ===")
        
        response = self.make_request("GET", f"/user-cars/user/{ADMIN_USER_ID}/all")
        
        if response and response.status_code == 200:
            cars = response.json()
            active_cars = [car for car in cars if car.get("isActive", False)]
            
            if len(active_cars) == 1:
                active_car = active_cars[0]
                if active_car.get("make") == "Toyota" and active_car.get("model") == "Supra":
                    self.log_test("Verify Active Switch", True, "Toyota Supra is now the active car")
                    return True
                else:
                    self.log_test("Verify Active Switch", False, f"Wrong car is active: {active_car.get('make')} {active_car.get('model')}")
                    return False
            else:
                self.log_test("Verify Active Switch", False, f"Expected 1 active car, got {len(active_cars)}")
                return False
        else:
            error_msg = response.json().get("detail", "Unknown error") if response else "No response"
            self.log_test("Verify Active Switch", False, f"Request failed: {error_msg}")
            return False
            
    def test_create_third_car_limit(self):
        """Test 7: Try to create a 3rd car - should get 400 error"""
        print("\n=== Test 7: Test Car Limit (3rd Car) ===")
        
        car_data = {
            "userId": ADMIN_USER_ID,
            "make": "Ford",
            "model": "Mustang",
            "year": "2024",
            "color": "Red",
            "isPublic": True,
            "description": "Third test car - should fail"
        }
        
        response = self.make_request("POST", "/user-cars/create-or-update-metadata", json=car_data)
        
        if response and response.status_code == 400:
            error_msg = response.json().get("detail", "")
            if "Maximum of 2 cars" in error_msg:
                self.log_test("Test Car Limit", True, f"Correctly rejected 3rd car: {error_msg}")
                return True
            else:
                self.log_test("Test Car Limit", False, f"Wrong error message: {error_msg}")
                return False
        else:
            status = response.status_code if response else "No response"
            self.log_test("Test Car Limit", False, f"Expected 400 error, got {status}")
            return False
            
    def test_delete_test_car(self, car_id):
        """Test 8: Clean up - DELETE /api/user-cars/{car_id}"""
        print("\n=== Test 8: Delete Test Car ===")
        
        response = self.make_request("DELETE", f"/user-cars/{car_id}", params={"user_id": ADMIN_USER_ID})
        
        if response and response.status_code == 200:
            data = response.json()
            self.log_test("Delete Test Car", True, f"Car deleted: {data.get('message')}")
            return True
        else:
            error_msg = response.json().get("detail", "Unknown error") if response else "No response"
            self.log_test("Delete Test Car", False, f"Request failed: {error_msg}")
            return False
            
    def test_restore_original_active(self, original_car_id):
        """Test 9: Restore original car as active"""
        print("\n=== Test 9: Restore Original Active Car ===")
        
        response = self.make_request("PUT", f"/user-cars/{original_car_id}/set-active")
        
        if response and response.status_code == 200:
            data = response.json()
            self.log_test("Restore Original Active", True, f"Original car restored as active: {data.get('message')}")
            return True
        else:
            error_msg = response.json().get("detail", "Unknown error") if response else "No response"
            self.log_test("Restore Original Active", False, f"Request failed: {error_msg}")
            return False
            
    def run_all_tests(self):
        """Run all multi-car garage tests"""
        print("🚗 MULTI-CAR GARAGE BACKEND TESTING")
        print("=" * 50)
        
        # Test 1: Admin login
        if not self.test_admin_login():
            print("\n❌ Cannot proceed without admin authentication")
            return False
            
        # Test 2: Get initial cars
        initial_cars = self.test_get_user_cars_all()
        original_car_id = None
        if initial_cars:
            # Find the original active car
            active_cars = [car for car in initial_cars if car.get("isActive", False)]
            if active_cars:
                original_car_id = active_cars[0].get("id")
            elif initial_cars:
                original_car_id = initial_cars[0].get("id")
        
        # Test 3: Create second car
        new_car_id = self.test_create_second_car()
        if not new_car_id:
            print("\n❌ Cannot proceed without creating second car")
            return False
            
        # Test 4: Verify two cars
        self.test_verify_two_cars()
        
        # Test 5: Set new car as active
        self.test_set_active_car(new_car_id)
        
        # Test 6: Verify active switch
        self.test_verify_active_switch()
        
        # Test 7: Test car limit
        self.test_create_third_car_limit()
        
        # Test 8: Clean up - delete test car
        self.test_delete_test_car(new_car_id)
        
        # Test 9: Restore original car as active
        if original_car_id:
            self.test_restore_original_active(original_car_id)
        else:
            # Use the hardcoded car ID from review request
            self.test_restore_original_active("69cb30e24ddc647117911a44")
        
        # Summary
        self.print_summary()
        return True
        
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 50)
        print("🏁 TEST SUMMARY")
        print("=" * 50)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        # Show failed tests
        failed_tests = [result for result in self.test_results if not result["success"]]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']}")
        else:
            print("\n✅ ALL TESTS PASSED!")
            
        return passed == total

def main():
    """Main test execution"""
    tester = MultiCarGarageTest()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()