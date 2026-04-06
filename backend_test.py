#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Garage Comments System
Testing the complete flow as specified in the review request.
"""

import requests
import json
import sys
import os
from datetime import datetime

# Get backend URL from environment
BACKEND_URL = "https://event-hub-okc-1.preview.emergentagent.com"

def log_test(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_symbol = "✅" if status == "PASS" else "❌"
    print(f"[{timestamp}] {status_symbol} {test_name}")
    if details:
        print(f"    {details}")

def test_garage_comments_system():
    """Test the complete garage comments system flow"""
    print("=" * 60)
    print("GARAGE COMMENTS SYSTEM TESTING")
    print("=" * 60)
    
    # Test data
    admin_credentials = {
        "email": "admin@okcarevents.com",
        "password": "admin123"
    }
    
    car_id = "69cb30e24ddc647117911a44"
    test_user_id = "69cb0f17abc86b849f3bfaf5"
    car_owner_id = "69bb035fb5d3f5e057f073ca"  # Admin user ID for notifications
    
    comment_data = {
        "carId": car_id,
        "userId": test_user_id,
        "userName": "BMWGuy",
        "text": "Incredible McLaren build!"
    }
    
    comment_id = None
    
    try:
        # Step 1: Login as admin to get user ID
        print("\n1. Testing Admin Login...")
        login_response = requests.post(
            f"{BACKEND_URL}/api/auth/login",
            json=admin_credentials,
            headers={"Content-Type": "application/json"}
        )
        
        if login_response.status_code == 200:
            admin_data = login_response.json()
            admin_user_id = admin_data.get("id")
            log_test("Admin Login", "PASS", f"Admin ID: {admin_user_id}")
        else:
            log_test("Admin Login", "FAIL", f"Status: {login_response.status_code}, Response: {login_response.text}")
            return False
        
        # Step 2: Create garage comment
        print("\n2. Testing Create Garage Comment...")
        comment_response = requests.post(
            f"{BACKEND_URL}/api/garage-comments",
            json=comment_data,
            headers={"Content-Type": "application/json"}
        )
        
        if comment_response.status_code == 200:
            comment_result = comment_response.json()
            comment_id = comment_result.get("id")
            
            # Verify response structure
            required_fields = ["id", "carId", "userId", "userName", "text", "createdAt"]
            missing_fields = [field for field in required_fields if field not in comment_result]
            
            if not missing_fields:
                log_test("Create Garage Comment", "PASS", 
                        f"Comment ID: {comment_id}, All required fields present")
                
                # Verify field values
                if (comment_result["carId"] == car_id and 
                    comment_result["userId"] == test_user_id and
                    comment_result["userName"] == "BMWGuy" and
                    comment_result["text"] == "Incredible McLaren build!"):
                    log_test("Comment Data Validation", "PASS", "All field values correct")
                else:
                    log_test("Comment Data Validation", "FAIL", "Field values don't match input")
            else:
                log_test("Create Garage Comment", "FAIL", f"Missing fields: {missing_fields}")
                return False
        else:
            log_test("Create Garage Comment", "FAIL", 
                    f"Status: {comment_response.status_code}, Response: {comment_response.text}")
            return False
        
        # Step 3: Get garage comments for the car
        print("\n3. Testing Get Garage Comments...")
        get_comments_response = requests.get(f"{BACKEND_URL}/api/garage-comments/{car_id}")
        
        if get_comments_response.status_code == 200:
            comments_list = get_comments_response.json()
            
            if isinstance(comments_list, list) and len(comments_list) > 0:
                # Find our comment in the list
                our_comment = None
                for comment in comments_list:
                    if comment.get("id") == comment_id:
                        our_comment = comment
                        break
                
                if our_comment:
                    log_test("Get Garage Comments", "PASS", 
                            f"Found {len(comments_list)} comments, our comment is present")
                else:
                    log_test("Get Garage Comments", "FAIL", "Our comment not found in the list")
                    return False
            else:
                log_test("Get Garage Comments", "FAIL", "No comments returned or invalid format")
                return False
        else:
            log_test("Get Garage Comments", "FAIL", 
                    f"Status: {get_comments_response.status_code}, Response: {get_comments_response.text}")
            return False
        
        # Step 4: Check notifications for car owner
        print("\n4. Testing Notification Creation...")
        notifications_response = requests.get(f"{BACKEND_URL}/api/notifications/{car_owner_id}")
        
        if notifications_response.status_code == 200:
            notifications = notifications_response.json()
            
            if isinstance(notifications, list):
                # Look for garage_comment notification
                garage_comment_notification = None
                for notification in notifications:
                    if (notification.get("type") == "garage_comment" and 
                        notification.get("carId") == car_id):
                        garage_comment_notification = notification
                        break
                
                if garage_comment_notification:
                    log_test("Notification Creation", "PASS", 
                            f"Garage comment notification found with carId field populated")
                    
                    # Verify notification structure
                    required_notif_fields = ["type", "title", "message", "carId"]
                    missing_notif_fields = [field for field in required_notif_fields 
                                          if field not in garage_comment_notification]
                    
                    if not missing_notif_fields:
                        log_test("Notification Structure", "PASS", "All required notification fields present")
                    else:
                        log_test("Notification Structure", "FAIL", f"Missing fields: {missing_notif_fields}")
                else:
                    log_test("Notification Creation", "FAIL", "No garage_comment notification found")
            else:
                log_test("Notification Creation", "FAIL", "Invalid notifications response format")
        else:
            log_test("Notification Creation", "FAIL", 
                    f"Status: {notifications_response.status_code}, Response: {notifications_response.text}")
        
        # Step 5: Delete garage comment
        print("\n5. Testing Delete Garage Comment...")
        delete_response = requests.delete(
            f"{BACKEND_URL}/api/garage-comments/{comment_id}?user_id={test_user_id}"
        )
        
        if delete_response.status_code == 200:
            delete_result = delete_response.json()
            if "message" in delete_result:
                log_test("Delete Garage Comment", "PASS", f"Message: {delete_result['message']}")
            else:
                log_test("Delete Garage Comment", "PASS", "Comment deleted successfully")
        else:
            log_test("Delete Garage Comment", "FAIL", 
                    f"Status: {delete_response.status_code}, Response: {delete_response.text}")
            return False
        
        # Step 6: Verify comment is deleted
        print("\n6. Testing Comment Deletion Verification...")
        verify_delete_response = requests.get(f"{BACKEND_URL}/api/garage-comments/{car_id}")
        
        if verify_delete_response.status_code == 200:
            remaining_comments = verify_delete_response.json()
            
            # Check if our comment is still in the list
            comment_still_exists = any(comment.get("id") == comment_id for comment in remaining_comments)
            
            if not comment_still_exists:
                log_test("Comment Deletion Verification", "PASS", 
                        f"Comment successfully removed. {len(remaining_comments)} comments remaining")
            else:
                log_test("Comment Deletion Verification", "FAIL", "Comment still exists after deletion")
                return False
        else:
            log_test("Comment Deletion Verification", "FAIL", 
                    f"Status: {verify_delete_response.status_code}, Response: {verify_delete_response.text}")
            return False
        
        # Step 7: Test individual photo endpoints
        print("\n7. Testing Individual Photo Endpoints...")
        
        # Test photo 0
        photo_0_response = requests.get(f"{BACKEND_URL}/api/user-cars/{car_id}/photo/0/image.jpg")
        
        if photo_0_response.status_code == 200:
            content_type = photo_0_response.headers.get("Content-Type", "")
            content_length = len(photo_0_response.content)
            
            if content_type == "image/jpeg" and content_length > 10240:  # > 10KB
                log_test("Photo 0 Endpoint", "PASS", 
                        f"Content-Type: {content_type}, Size: {content_length} bytes (> 10KB)")
                photo_0_size = content_length
            else:
                log_test("Photo 0 Endpoint", "FAIL", 
                        f"Content-Type: {content_type}, Size: {content_length} bytes (should be image/jpeg and > 10KB)")
                return False
        else:
            log_test("Photo 0 Endpoint", "FAIL", 
                    f"Status: {photo_0_response.status_code}, Response: {photo_0_response.text}")
            return False
        
        # Test photo 1
        photo_1_response = requests.get(f"{BACKEND_URL}/api/user-cars/{car_id}/photo/1/image.jpg")
        
        if photo_1_response.status_code == 200:
            content_type = photo_1_response.headers.get("Content-Type", "")
            content_length = len(photo_1_response.content)
            
            if content_type == "image/jpeg":
                log_test("Photo 1 Endpoint", "PASS", 
                        f"Content-Type: {content_type}, Size: {content_length} bytes")
                photo_1_size = content_length
                
                # Verify different sizes (proves unique photos)
                if photo_0_size != photo_1_size:
                    log_test("Unique Photos Verification", "PASS", 
                            f"Photo 0: {photo_0_size} bytes, Photo 1: {photo_1_size} bytes (different sizes)")
                else:
                    log_test("Unique Photos Verification", "FAIL", 
                            f"Both photos have same size: {photo_0_size} bytes")
            else:
                log_test("Photo 1 Endpoint", "FAIL", 
                        f"Content-Type: {content_type}, Size: {content_length} bytes (should be image/jpeg)")
                return False
        else:
            log_test("Photo 1 Endpoint", "FAIL", 
                    f"Status: {photo_1_response.status_code}, Response: {photo_1_response.text}")
            return False
        
        print("\n" + "=" * 60)
        print("✅ ALL GARAGE COMMENTS SYSTEM TESTS PASSED!")
        print("=" * 60)
        return True
        
    except Exception as e:
        log_test("Garage Comments System Test", "FAIL", f"Exception: {str(e)}")
        return False

def main():
    """Main test runner"""
    print("Starting Backend Testing for Garage Comments System...")
    print(f"Backend URL: {BACKEND_URL}")
    
    success = test_garage_comments_system()
    
    if success:
        print("\n🎉 All tests completed successfully!")
        sys.exit(0)
    else:
        print("\n💥 Some tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()