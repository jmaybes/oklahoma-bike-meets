#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://event-hub-okc-1.preview.emergentagent.com/api"

# Test credentials from test_result.md
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

def test_popup_invite_rsvp_system():
    """Test the Pop-Up Invite RSVP system as specified in the review request"""
    
    print("=" * 80)
    print("TESTING: Pop-Up Invite RSVP System")
    print("=" * 80)
    print()
    
    # Step 1: Login as admin
    print("Step 1: Login as admin")
    login_data = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
        if response.status_code == 200:
            admin_user = response.json()
            admin_id = admin_user.get("id")
            log_test("Admin Login", "PASS", f"Admin ID: {admin_id}")
        else:
            log_test("Admin Login", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Admin Login", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Step 2: Send a popup invite to self
    print("Step 2: Send popup invite to self")
    popup_invite_data = {
        "senderId": admin_id,
        "senderName": "Admin",
        "recipientIds": [admin_id],
        "message": "RSVP test invite!",
        "shareLocation": True,
        "latitude": 35.4676,
        "longitude": -97.5164,
        "locationDuration": 30
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/meetup/send-popup-invite", json=popup_invite_data)
        if response.status_code == 200:
            invite_response = response.json()
            location_share_id = invite_response.get("locationShareId")
            log_test("Send Popup Invite", "PASS", f"Invites sent: {invite_response.get('invitesSent')}, Location Share ID: {location_share_id}")
        else:
            log_test("Send Popup Invite", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Send Popup Invite", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Step 3: Get the message thread (admin chatting with self)
    print("Step 3: Get message thread")
    try:
        response = requests.get(f"{BACKEND_URL}/messages/thread/{admin_id}/{admin_id}")
        if response.status_code == 200:
            messages = response.json()
            popup_message = None
            for msg in messages:
                if msg.get("isPopupInvite"):
                    popup_message = msg
                    break
            
            if popup_message:
                popup_msg_id = popup_message["id"]
                has_location_share_id = "locationShareId" in popup_message
                log_test("Get Message Thread", "PASS", 
                        f"Found popup invite message ID: {popup_msg_id}, Has locationShareId: {has_location_share_id}")
            else:
                log_test("Get Message Thread", "FAIL", "No popup invite message found in thread")
                return False
        else:
            log_test("Get Message Thread", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Get Message Thread", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Step 4: RSVP as attending
    print("Step 4: RSVP as attending")
    rsvp_data = {
        "messageId": popup_msg_id,
        "userId": admin_id,
        "userName": "Admin",
        "status": "attending"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/meetup/popup-rsvp", json=rsvp_data)
        if response.status_code == 200:
            rsvp_response = response.json()
            returned_status = rsvp_response.get("status")
            if returned_status == "attending":
                log_test("RSVP Attending", "PASS", f"Status: {returned_status}")
            else:
                log_test("RSVP Attending", "FAIL", f"Expected 'attending', got '{returned_status}'")
                return False
        else:
            log_test("RSVP Attending", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("RSVP Attending", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Step 5: Get RSVPs for the message
    print("Step 5: Get RSVPs for the message")
    try:
        response = requests.get(f"{BACKEND_URL}/meetup/popup-rsvp/{popup_msg_id}")
        if response.status_code == 200:
            rsvp_data = response.json()
            attending = rsvp_data.get("attending", 0)
            declined = rsvp_data.get("declined", 0)
            rsvps = rsvp_data.get("rsvps", [])
            
            if attending == 1 and declined == 0 and len(rsvps) == 1:
                admin_rsvp = rsvps[0]
                if admin_rsvp.get("userId") == admin_id and admin_rsvp.get("status") == "attending":
                    log_test("Get RSVPs (Attending)", "PASS", 
                            f"Attending: {attending}, Declined: {declined}, Admin RSVP found")
                else:
                    log_test("Get RSVPs (Attending)", "FAIL", "Admin RSVP not found or incorrect status")
                    return False
            else:
                log_test("Get RSVPs (Attending)", "FAIL", 
                        f"Expected attending=1, declined=0, got attending={attending}, declined={declined}")
                return False
        else:
            log_test("Get RSVPs (Attending)", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Get RSVPs (Attending)", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Step 6: Change RSVP to declined
    print("Step 6: Change RSVP to declined")
    rsvp_data = {
        "messageId": popup_msg_id,
        "userId": admin_id,
        "userName": "Admin",
        "status": "declined"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/meetup/popup-rsvp", json=rsvp_data)
        if response.status_code == 200:
            rsvp_response = response.json()
            returned_status = rsvp_response.get("status")
            if returned_status == "declined":
                log_test("RSVP Declined", "PASS", f"Status: {returned_status}")
            else:
                log_test("RSVP Declined", "FAIL", f"Expected 'declined', got '{returned_status}'")
                return False
        else:
            log_test("RSVP Declined", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("RSVP Declined", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Step 7: Get RSVPs again (should show upsert behavior)
    print("Step 7: Get RSVPs again (verify upsert)")
    try:
        response = requests.get(f"{BACKEND_URL}/meetup/popup-rsvp/{popup_msg_id}")
        if response.status_code == 200:
            rsvp_data = response.json()
            attending = rsvp_data.get("attending", 0)
            declined = rsvp_data.get("declined", 0)
            rsvps = rsvp_data.get("rsvps", [])
            
            if attending == 0 and declined == 1 and len(rsvps) == 1:
                admin_rsvp = rsvps[0]
                if admin_rsvp.get("userId") == admin_id and admin_rsvp.get("status") == "declined":
                    log_test("Get RSVPs (Declined)", "PASS", 
                            f"Attending: {attending}, Declined: {declined}, Upsert behavior confirmed")
                else:
                    log_test("Get RSVPs (Declined)", "FAIL", "Admin RSVP not found or incorrect status")
                    return False
            else:
                log_test("Get RSVPs (Declined)", "FAIL", 
                        f"Expected attending=0, declined=1, got attending={attending}, declined={declined}")
                return False
        else:
            log_test("Get RSVPs (Declined)", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Get RSVPs (Declined)", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Step 8: Validation - invalid status
    print("Step 8: Validation - invalid status")
    invalid_rsvp_data = {
        "messageId": popup_msg_id,
        "userId": admin_id,
        "userName": "Admin",
        "status": "maybe"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/meetup/popup-rsvp", json=invalid_rsvp_data)
        if response.status_code == 400:
            log_test("Invalid Status Validation", "PASS", "400 error returned for invalid status")
        else:
            log_test("Invalid Status Validation", "FAIL", 
                    f"Expected 400 error, got {response.status_code}")
            return False
    except Exception as e:
        log_test("Invalid Status Validation", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Step 9: Validation - non-popup message
    print("Step 9: Validation - non-popup message")
    
    # First send a regular message
    regular_message_data = {
        "senderId": admin_id,
        "recipientId": admin_id,
        "content": "normal message"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/messages", json=regular_message_data)
        if response.status_code == 200:
            regular_msg = response.json()
            regular_msg_id = regular_msg["id"]
            log_test("Send Regular Message", "PASS", f"Message ID: {regular_msg_id}")
        else:
            log_test("Send Regular Message", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Send Regular Message", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Now try to RSVP to the regular message
    try:
        invalid_rsvp_data = {
            "messageId": regular_msg_id,
            "userId": admin_id,
            "userName": "Admin",
            "status": "attending"
        }
        
        response = requests.post(f"{BACKEND_URL}/meetup/popup-rsvp", json=invalid_rsvp_data)
        if response.status_code == 400:
            error_message = response.json().get("detail", "")
            if "not a pop-up invite" in error_message:
                log_test("Non-Popup Message Validation", "PASS", 
                        f"400 error with correct message: {error_message}")
            else:
                log_test("Non-Popup Message Validation", "FAIL", 
                        f"400 error but wrong message: {error_message}")
                return False
        else:
            log_test("Non-Popup Message Validation", "FAIL", 
                    f"Expected 400 error, got {response.status_code}")
            return False
    except Exception as e:
        log_test("Non-Popup Message Validation", "FAIL", f"Exception: {str(e)}")
        return False
    
    print("=" * 80)
    print("✅ ALL POP-UP INVITE RSVP TESTS PASSED!")
    print("=" * 80)
    return True

if __name__ == "__main__":
    success = test_popup_invite_rsvp_system()
    sys.exit(0 if success else 1)