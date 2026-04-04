#!/usr/bin/env python3
"""
Backend API Testing for Oklahoma Car Events - Pop-Up Invite Feature
Testing the Pop-Up Invite endpoints as specified in the review request.
"""

import requests
import json
import time
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://event-hub-okc-1.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

# Test credentials
ADMIN_EMAIL = "admin@okcarevents.com"
ADMIN_PASSWORD = "admin123"

def log_test(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_symbol = "✅" if status == "PASS" else "❌"
    print(f"[{timestamp}] {status_symbol} {test_name}")
    if details:
        print(f"    {details}")
    print()

def test_admin_login():
    """Test 1: Login as admin to get user ID"""
    print("=" * 60)
    print("TESTING POP-UP INVITE FEATURE ENDPOINTS")
    print("=" * 60)
    
    try:
        response = requests.post(f"{API_BASE}/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            admin_user_id = data.get("id")
            admin_name = data.get("name", "Admin")
            log_test("Admin Login", "PASS", f"Admin ID: {admin_user_id}, Name: {admin_name}")
            return admin_user_id, admin_name
        else:
            log_test("Admin Login", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return None, None
            
    except Exception as e:
        log_test("Admin Login", "FAIL", f"Exception: {str(e)}")
        return None, None

def test_prewritten_messages():
    """Test 2: Test the existing prewritten messages endpoint"""
    try:
        response = requests.get(f"{API_BASE}/meetup/prewritten-messages")
        
        if response.status_code == 200:
            data = response.json()
            messages = data.get("messages", [])
            log_test("Prewritten Messages", "PASS", f"Found {len(messages)} prewritten messages")
            return True
        else:
            log_test("Prewritten Messages", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        log_test("Prewritten Messages", "FAIL", f"Exception: {str(e)}")
        return False

def test_popup_invite_with_location(admin_user_id, admin_name):
    """Test 3: Test Pop-Up Invite WITH location sharing"""
    try:
        # Oklahoma City coordinates
        latitude = 35.4676
        longitude = -97.5164
        
        payload = {
            "senderId": admin_user_id,
            "senderName": admin_name,
            "recipientIds": [admin_user_id],  # Send to self for testing
            "message": "Test pop-up meet tonight!",
            "shareLocation": True,
            "latitude": latitude,
            "longitude": longitude,
            "locationDuration": 30
        }
        
        response = requests.post(f"{API_BASE}/meetup/send-popup-invite", json=payload)
        
        if response.status_code == 200:
            data = response.json()
            invites_sent = data.get("invitesSent", 0)
            location_share_id = data.get("locationShareId")
            
            if invites_sent == 1 and location_share_id is not None:
                log_test("Pop-Up Invite WITH Location", "PASS", 
                        f"Invites sent: {invites_sent}, Location Share ID: {location_share_id}")
                return location_share_id
            else:
                log_test("Pop-Up Invite WITH Location", "FAIL", 
                        f"Expected invitesSent=1 and locationShareId!=null, got: {data}")
                return None
        else:
            log_test("Pop-Up Invite WITH Location", "FAIL", 
                    f"Status: {response.status_code}, Response: {response.text}")
            return None
            
    except Exception as e:
        log_test("Pop-Up Invite WITH Location", "FAIL", f"Exception: {str(e)}")
        return None

def test_location_share_retrieval(location_share_id):
    """Test 4: Retrieve the location share"""
    if not location_share_id:
        log_test("Location Share Retrieval", "FAIL", "No location share ID provided")
        return False
        
    try:
        response = requests.get(f"{API_BASE}/meetup/location-share/{location_share_id}")
        
        if response.status_code == 200:
            data = response.json()
            expired = data.get("expired", True)
            has_latitude = "latitude" in data
            has_longitude = "longitude" in data
            remaining_seconds = data.get("remainingSeconds", 0)
            
            if not expired and has_latitude and has_longitude and remaining_seconds > 0:
                log_test("Location Share Retrieval", "PASS", 
                        f"Expired: {expired}, Has coordinates: {has_latitude and has_longitude}, "
                        f"Remaining: {remaining_seconds}s")
                return True
            else:
                log_test("Location Share Retrieval", "FAIL", 
                        f"Expected expired=false, coordinates present, remainingSeconds>0, got: {data}")
                return False
        else:
            log_test("Location Share Retrieval", "FAIL", 
                    f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        log_test("Location Share Retrieval", "FAIL", f"Exception: {str(e)}")
        return False

def test_popup_invite_without_location(admin_user_id, admin_name):
    """Test 5: Test Pop-Up Invite WITHOUT location sharing"""
    try:
        payload = {
            "senderId": admin_user_id,
            "senderName": admin_name,
            "recipientIds": [admin_user_id],  # Send to self for testing
            "message": "Quick meetup, no location!",
            "shareLocation": False,
            "locationDuration": 30
        }
        
        response = requests.post(f"{API_BASE}/meetup/send-popup-invite", json=payload)
        
        if response.status_code == 200:
            data = response.json()
            invites_sent = data.get("invitesSent", 0)
            location_share_id = data.get("locationShareId")
            
            if invites_sent == 1 and location_share_id is None:
                log_test("Pop-Up Invite WITHOUT Location", "PASS", 
                        f"Invites sent: {invites_sent}, Location Share ID: {location_share_id}")
                return True
            else:
                log_test("Pop-Up Invite WITHOUT Location", "FAIL", 
                        f"Expected invitesSent=1 and locationShareId=null, got: {data}")
                return False
        else:
            log_test("Pop-Up Invite WITHOUT Location", "FAIL", 
                    f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        log_test("Pop-Up Invite WITHOUT Location", "FAIL", f"Exception: {str(e)}")
        return False

def test_validation_empty_recipients(admin_user_id, admin_name):
    """Test 6: Test validation - empty recipientIds"""
    try:
        payload = {
            "senderId": admin_user_id,
            "senderName": admin_name,
            "recipientIds": [],  # Empty array
            "message": "This should fail",
            "shareLocation": False,
            "locationDuration": 30
        }
        
        response = requests.post(f"{API_BASE}/meetup/send-popup-invite", json=payload)
        
        if response.status_code == 400:
            log_test("Validation - Empty Recipients", "PASS", 
                    f"Correctly returned 400 error: {response.text}")
            return True
        else:
            log_test("Validation - Empty Recipients", "FAIL", 
                    f"Expected 400 error, got status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        log_test("Validation - Empty Recipients", "FAIL", f"Exception: {str(e)}")
        return False

def test_validation_invalid_sender():
    """Test 7: Test validation - invalid senderId"""
    try:
        payload = {
            "senderId": "invalid_id",
            "senderName": "Test User",
            "recipientIds": ["507f1f77bcf86cd799439011"],  # Valid ObjectId format
            "message": "This should fail",
            "shareLocation": False,
            "locationDuration": 30
        }
        
        response = requests.post(f"{API_BASE}/meetup/send-popup-invite", json=payload)
        
        if response.status_code == 400:
            log_test("Validation - Invalid Sender ID", "PASS", 
                    f"Correctly returned 400 error: {response.text}")
            return True
        else:
            log_test("Validation - Invalid Sender ID", "FAIL", 
                    f"Expected 400 error, got status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        log_test("Validation - Invalid Sender ID", "FAIL", f"Exception: {str(e)}")
        return False

def test_messages_created(admin_user_id):
    """Test 8: Verify messages were created by checking conversations"""
    try:
        response = requests.get(f"{API_BASE}/messages/conversations/{admin_user_id}")
        
        if response.status_code == 200:
            data = response.json()
            conversation_count = len(data)
            
            if conversation_count >= 1:
                log_test("Messages Created Verification", "PASS", 
                        f"Found {conversation_count} conversation(s)")
                return True
            else:
                log_test("Messages Created Verification", "FAIL", 
                        f"Expected at least 1 conversation, found: {conversation_count}")
                return False
        else:
            log_test("Messages Created Verification", "FAIL", 
                    f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        log_test("Messages Created Verification", "FAIL", f"Exception: {str(e)}")
        return False

def main():
    """Run all Pop-Up Invite feature tests"""
    print(f"Testing Backend URL: {BACKEND_URL}")
    print(f"API Base: {API_BASE}")
    print()
    
    # Test 1: Admin login
    admin_user_id, admin_name = test_admin_login()
    if not admin_user_id:
        print("❌ Cannot proceed without admin login. Exiting.")
        return
    
    # Test 2: Prewritten messages
    test_prewritten_messages()
    
    # Test 3: Pop-Up Invite WITH location sharing
    location_share_id = test_popup_invite_with_location(admin_user_id, admin_name)
    
    # Test 4: Retrieve location share
    if location_share_id:
        test_location_share_retrieval(location_share_id)
    
    # Test 5: Pop-Up Invite WITHOUT location sharing
    test_popup_invite_without_location(admin_user_id, admin_name)
    
    # Test 6: Validation - empty recipients
    test_validation_empty_recipients(admin_user_id, admin_name)
    
    # Test 7: Validation - invalid sender ID
    test_validation_invalid_sender()
    
    # Test 8: Verify messages were created
    test_messages_created(admin_user_id)
    
    print("=" * 60)
    print("POP-UP INVITE FEATURE TESTING COMPLETED")
    print("=" * 60)

if __name__ == "__main__":
    main()