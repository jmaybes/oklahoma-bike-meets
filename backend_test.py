#!/usr/bin/env python3
"""
Backend Test Suite for Oklahoma Car Events - Chunked Garage Photo Upload System
Tests the new chunked photo upload functionality as specified in the review request.
"""

import requests
import json
import sys
import time
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://event-hub-okc-1.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@okcarevents.com"
ADMIN_PASSWORD = "admin123"

# Test data - small base64 encoded 1x1 pixel JPEG images
TEST_PHOTO_1 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k="
TEST_PHOTO_2 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k="

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
        
    def add_pass(self, test_name: str):
        self.passed += 1
        print(f"✅ {test_name}")
        
    def add_fail(self, test_name: str, error: str):
        self.failed += 1
        self.errors.append(f"{test_name}: {error}")
        print(f"❌ {test_name}: {error}")
        
    def summary(self):
        total = self.passed + self.failed
        print(f"\n=== TEST SUMMARY ===")
        print(f"Total: {total}, Passed: {self.passed}, Failed: {self.failed}")
        if self.errors:
            print("\nFAILED TESTS:")
            for error in self.errors:
                print(f"  - {error}")
        return self.failed == 0

def make_request(method: str, endpoint: str, data: Dict = None, params: Dict = None, headers: Dict = None) -> requests.Response:
    """Make HTTP request with proper error handling"""
    url = f"{BASE_URL}{endpoint}"
    default_headers = {"Content-Type": "application/json"}
    if headers:
        default_headers.update(headers)
    
    try:
        if method == "GET":
            response = requests.get(url, params=params, headers=default_headers, timeout=30)
        elif method == "POST":
            response = requests.post(url, json=data, params=params, headers=default_headers, timeout=30)
        elif method == "PUT":
            response = requests.put(url, json=data, params=params, headers=default_headers, timeout=30)
        elif method == "DELETE":
            response = requests.delete(url, params=params, headers=default_headers, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return response
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        raise

def test_chunked_garage_photo_upload():
    """Test the chunked garage photo upload system"""
    result = TestResult()
    admin_id = None
    car_id = None
    original_car_data = None
    initial_photo_count = 0  # Initialize this variable
    
    print("🚀 Starting Chunked Garage Photo Upload System Tests")
    print("=" * 60)
    
    # Step 1: Login as admin
    try:
        login_data = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        response = make_request("POST", "/auth/login", login_data)
        
        if response.status_code == 200:
            admin_data = response.json()
            admin_id = admin_data.get("id")
            if admin_id:
                result.add_pass("Admin login successful")
            else:
                result.add_fail("Admin login", "No admin ID in response")
                return result
        else:
            result.add_fail("Admin login", f"Status {response.status_code}: {response.text}")
            return result
    except Exception as e:
        result.add_fail("Admin login", f"Exception: {str(e)}")
        return result
    
    # Check if admin already has a car (to restore later)
    try:
        response = make_request("GET", f"/user-cars/user/{admin_id}", params={"include_photos": True})
        if response.status_code == 200:
            original_car_data = response.json()
            if original_car_data:
                print(f"📝 Admin has existing car: {original_car_data.get('year', 'Unknown')} {original_car_data.get('make', 'Unknown')} {original_car_data.get('model', 'Unknown')}")
                car_id = original_car_data.get("id")
            else:
                print("📝 Admin has no existing car")
        else:
            result.add_fail("Check existing car", f"Status {response.status_code}: {response.text}")
    except Exception as e:
        result.add_fail("Check existing car", f"Exception: {str(e)}")
    
    # Step 2: Test metadata-only save (create new car or update existing)
    try:
        metadata = {
            "userId": admin_id,
            "make": "Test",
            "model": "Car", 
            "year": "2025",
            "color": "Red",
            "isPublic": True,
            "photos": []
        }
        
        response = make_request("POST", "/user-cars/create-or-update-metadata", metadata)
        
        if response.status_code == 200:
            car_data = response.json()
            car_id = car_data.get("id")
            photo_count = car_data.get("photoCount", 0)
            
            if car_id:
                result.add_pass("Metadata-only save")
                print(f"  Car ID: {car_id}, Photo Count: {photo_count} (existing photos preserved)")
                # Store the initial photo count for later tests
                initial_photo_count = photo_count
            else:
                result.add_fail("Metadata-only save", f"Missing car ID")
        else:
            result.add_fail("Metadata-only save", f"Status {response.status_code}: {response.text}")
    except Exception as e:
        result.add_fail("Metadata-only save", f"Exception: {str(e)}")
        initial_photo_count = 0
    
    if not car_id:
        result.add_fail("Test setup", "No car ID available for photo upload tests")
        return result
    
    # Step 3: Upload first photo
    try:
        photo_data = {"photo": TEST_PHOTO_1}
        response = make_request("POST", f"/user-cars/{car_id}/photos/upload", photo_data, params={"user_id": admin_id})
        
        if response.status_code == 200:
            upload_result = response.json()
            expected_count = initial_photo_count + 1
            if upload_result.get("success") and upload_result.get("photoCount") == expected_count:
                result.add_pass("Upload first photo")
                print(f"  Photo Count: {upload_result.get('photoCount')}")
            else:
                result.add_fail("Upload first photo", f"Expected count {expected_count}, got {upload_result.get('photoCount')}")
        else:
            result.add_fail("Upload first photo", f"Status {response.status_code}: {response.text}")
    except Exception as e:
        result.add_fail("Upload first photo", f"Exception: {str(e)}")
    
    # Step 4: Upload second photo
    try:
        photo_data = {"photo": TEST_PHOTO_2}
        response = make_request("POST", f"/user-cars/{car_id}/photos/upload", photo_data, params={"user_id": admin_id})
        
        if response.status_code == 200:
            upload_result = response.json()
            expected_count = initial_photo_count + 2
            if upload_result.get("success") and upload_result.get("photoCount") == expected_count:
                result.add_pass("Upload second photo")
                print(f"  Photo Count: {upload_result.get('photoCount')}")
            else:
                result.add_fail("Upload second photo", f"Expected count {expected_count}, got {upload_result.get('photoCount')}")
        else:
            result.add_fail("Upload second photo", f"Status {response.status_code}: {response.text}")
    except Exception as e:
        result.add_fail("Upload second photo", f"Exception: {str(e)}")
    
    # Step 5: Verify photos are persisted
    try:
        response = make_request("GET", f"/user-cars/user/{admin_id}", params={"include_photos": True})
        
        if response.status_code == 200:
            car_data = response.json()
            if car_data:
                photos = car_data.get("photos", [])
                expected_count = initial_photo_count + 2
                if len(photos) == expected_count:
                    result.add_pass("Verify photos persisted")
                    print(f"  Found {len(photos)} photos in database")
                else:
                    result.add_fail("Verify photos persisted", f"Expected {expected_count} photos, found {len(photos)}")
            else:
                result.add_fail("Verify photos persisted", "No car data returned")
        else:
            result.add_fail("Verify photos persisted", f"Status {response.status_code}: {response.text}")
    except Exception as e:
        result.add_fail("Verify photos persisted", f"Exception: {str(e)}")
    
    # Step 6: Delete a photo by index
    try:
        response = make_request("DELETE", f"/user-cars/{car_id}/photos/0", params={"user_id": admin_id})
        
        if response.status_code == 200:
            delete_result = response.json()
            expected_count = initial_photo_count + 1  # After deleting one of the two we added
            if delete_result.get("success") and delete_result.get("photoCount") == expected_count:
                result.add_pass("Delete photo by index")
                print(f"  Photo Count after deletion: {delete_result.get('photoCount')}")
            else:
                result.add_fail("Delete photo by index", f"Expected count {expected_count}, got {delete_result.get('photoCount')}")
        else:
            result.add_fail("Delete photo by index", f"Status {response.status_code}: {response.text}")
    except Exception as e:
        result.add_fail("Delete photo by index", f"Exception: {str(e)}")
    
    # Step 7: Test security - try uploading to another user's car
    try:
        photo_data = {"photo": TEST_PHOTO_1}
        response = make_request("POST", f"/user-cars/{car_id}/photos/upload", photo_data, params={"user_id": "fake_user_id"})
        
        if response.status_code == 403:
            result.add_pass("Security test - unauthorized upload")
        else:
            result.add_fail("Security test - unauthorized upload", f"Expected 403, got {response.status_code}")
    except Exception as e:
        result.add_fail("Security test - unauthorized upload", f"Exception: {str(e)}")
    
    # Step 8: Verify public garages endpoint still works
    try:
        response = make_request("GET", "/user-cars/public", params={"sort": "likes"})
        
        if response.status_code == 200:
            public_cars = response.json()
            if isinstance(public_cars, list):
                # Look for our test car if it's public
                test_car_found = any(car.get("make") == "Test" and car.get("model") == "Car" for car in public_cars)
                result.add_pass("Public garages endpoint")
                print(f"  Found {len(public_cars)} public cars, test car visible: {test_car_found}")
            else:
                result.add_fail("Public garages endpoint", f"Expected list, got {type(public_cars)}")
        else:
            result.add_fail("Public garages endpoint", f"Status {response.status_code}: {response.text}")
    except Exception as e:
        result.add_fail("Public garages endpoint", f"Exception: {str(e)}")
    
    # Step 9: Clean up - restore original car data if it existed
    try:
        if original_car_data:
            # Restore the original McLaren data
            restore_data = {
                "userId": admin_id,
                "make": original_car_data.get("make", "McLaren"),
                "model": original_car_data.get("model", "570s MSO-X"),
                "year": original_car_data.get("year", "2018"),
                "color": original_car_data.get("color", "Orange"),
                "isPublic": original_car_data.get("isPublic", True),
                "photos": []  # Will be empty for metadata-only save
            }
            
            response = make_request("POST", "/user-cars/create-or-update-metadata", restore_data)
            
            if response.status_code == 200:
                result.add_pass("Cleanup - restore original car")
                print(f"  Restored: {restore_data['year']} {restore_data['make']} {restore_data['model']}")
            else:
                result.add_fail("Cleanup - restore original car", f"Status {response.status_code}: {response.text}")
        else:
            # If no original car existed, we could delete the test car, but the endpoint creates/updates
            # so we'll just leave the test car as is
            result.add_pass("Cleanup - no original car to restore")
    except Exception as e:
        result.add_fail("Cleanup - restore original car", f"Exception: {str(e)}")
    
    return result

def main():
    """Run all tests"""
    print("🔧 Oklahoma Car Events - Chunked Garage Photo Upload Tests")
    print("=" * 60)
    
    # Test the chunked garage photo upload system
    result = test_chunked_garage_photo_upload()
    
    # Print final summary
    print("\n" + "=" * 60)
    success = result.summary()
    
    if success:
        print("🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print("💥 SOME TESTS FAILED!")
        sys.exit(1)

if __name__ == "__main__":
    main()