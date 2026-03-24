#!/usr/bin/env python3

"""
RSVP and Notification System Testing Script
Tests the new RSVP endpoints and notification functionality
"""

import requests
import json
import sys

# Backend URL from frontend environment
BASE_URL = "https://carfest-okc.preview.emergentagent.com/api"

def print_result(test_name, success, details):
    """Print test result in a clear format"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"    Details: {details}")
    print()

def test_admin_login():
    """Login as admin user to get userId for testing"""
    print("🔐 Logging in as admin user...")
    
    url = f"{BASE_URL}/auth/login"
    data = {
        "email": "admin@okcarevents.com",
        "password": "admin123"
    }
    
    try:
        response = requests.post(url, json=data)
        if response.status_code == 200:
            user_data = response.json()
            print_result("Admin Login", True, f"Logged in as {user_data['name']} (ID: {user_data['id']})")
            return user_data["id"]
        else:
            print_result("Admin Login", False, f"Status: {response.status_code}, Response: {response.text}")
            return None
    except Exception as e:
        print_result("Admin Login", False, f"Exception: {str(e)}")
        return None

def test_get_events():
    """Get existing events to use for RSVP testing"""
    print("📅 Fetching existing events...")
    
    url = f"{BASE_URL}/events"
    
    try:
        response = requests.get(url)
        if response.status_code == 200:
            events = response.json()
            if events:
                event = events[0]
                print_result("Get Events", True, f"Found {len(events)} events, using '{event['title']}' (ID: {event['id']})")
                return event["id"]
            else:
                print_result("Get Events", False, "No events found")
                return None
        else:
            print_result("Get Events", False, f"Status: {response.status_code}, Response: {response.text}")
            return None
    except Exception as e:
        print_result("Get Events", False, f"Exception: {str(e)}")
        return None

def test_create_rsvp(user_id, event_id):
    """Test POST /api/rsvp - Create an RSVP"""
    print("📝 Testing RSVP Creation...")
    
    url = f"{BASE_URL}/rsvp"
    data = {
        "userId": user_id,
        "eventId": event_id
    }
    
    try:
        response = requests.post(url, json=data)
        if response.status_code == 200:
            rsvp_data = response.json()
            expected_fields = ["id", "message", "userId", "eventId", "eventTitle", "eventDate", "eventTime", "reminderSent", "createdAt"]
            missing_fields = [field for field in expected_fields if field not in rsvp_data]
            
            if not missing_fields:
                print_result("Create RSVP", True, f"RSVP created successfully. Message: {rsvp_data['message']}")
                return True
            else:
                print_result("Create RSVP", False, f"Missing fields in response: {missing_fields}")
                return False
        elif response.status_code == 400 and "Already RSVP'd" in response.text:
            print_result("Create RSVP", True, "User already has RSVP for this event (expected behavior)")
            return True
        else:
            print_result("Create RSVP", False, f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        print_result("Create RSVP", False, f"Exception: {str(e)}")
        return False

def test_check_rsvp(user_id, event_id):
    """Test GET /api/rsvp/check/{user_id}/{event_id} - Check if user has RSVP'd"""
    print("🔍 Testing RSVP Check...")
    
    url = f"{BASE_URL}/rsvp/check/{user_id}/{event_id}"
    
    try:
        response = requests.get(url)
        if response.status_code == 200:
            check_data = response.json()
            if "hasRsvp" in check_data:
                has_rsvp = check_data["hasRsvp"]
                print_result("Check RSVP", True, f"hasRsvp: {has_rsvp}")
                return has_rsvp
            else:
                print_result("Check RSVP", False, "Response missing 'hasRsvp' field")
                return False
        else:
            print_result("Check RSVP", False, f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        print_result("Check RSVP", False, f"Exception: {str(e)}")
        return False

def test_get_user_rsvps(user_id):
    """Test GET /api/rsvp/user/{user_id} - Get all user RSVPs"""
    print("📋 Testing Get User RSVPs...")
    
    url = f"{BASE_URL}/rsvp/user/{user_id}"
    
    try:
        response = requests.get(url)
        if response.status_code == 200:
            rsvps = response.json()
            if isinstance(rsvps, list):
                if rsvps:
                    required_fields = ["id", "userId", "eventId", "eventTitle", "eventDate", "eventTime", "reminderSent", "createdAt"]
                    first_rsvp = rsvps[0]
                    missing_fields = [field for field in required_fields if field not in first_rsvp]
                    
                    if not missing_fields:
                        print_result("Get User RSVPs", True, f"Found {len(rsvps)} RSVPs for user. First event: '{first_rsvp['eventTitle']}'")
                        return True
                    else:
                        print_result("Get User RSVPs", False, f"Missing fields in RSVP data: {missing_fields}")
                        return False
                else:
                    print_result("Get User RSVPs", True, "No RSVPs found for user (empty array)")
                    return True
            else:
                print_result("Get User RSVPs", False, f"Expected array, got: {type(rsvps)}")
                return False
        else:
            print_result("Get User RSVPs", False, f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        print_result("Get User RSVPs", False, f"Exception: {str(e)}")
        return False

def test_get_notifications(user_id):
    """Test GET /api/notifications/{user_id} - Get user notifications"""
    print("🔔 Testing Get User Notifications...")
    
    url = f"{BASE_URL}/notifications/{user_id}"
    
    try:
        response = requests.get(url)
        if response.status_code == 200:
            notifications = response.json()
            if isinstance(notifications, list):
                if notifications:
                    required_fields = ["id", "userId", "type", "title", "message", "isRead", "createdAt"]
                    first_notification = notifications[0]
                    missing_fields = [field for field in required_fields if field not in first_notification]
                    
                    if not missing_fields:
                        rsvp_notifications = [n for n in notifications if n.get("type") == "rsvp_confirmation"]
                        print_result("Get User Notifications", True, 
                                   f"Found {len(notifications)} total notifications, {len(rsvp_notifications)} RSVP confirmations")
                        
                        # Show the RSVP confirmation notification if it exists
                        if rsvp_notifications:
                            rsvp_notif = rsvp_notifications[0]
                            print(f"    📧 RSVP Notification: '{rsvp_notif['title']}'")
                            print(f"    📝 Message: '{rsvp_notif['message']}'")
                        
                        return True
                    else:
                        print_result("Get User Notifications", False, f"Missing fields in notification data: {missing_fields}")
                        return False
                else:
                    print_result("Get User Notifications", True, "No notifications found for user (empty array)")
                    return True
            else:
                print_result("Get User Notifications", False, f"Expected array, got: {type(notifications)}")
                return False
        else:
            print_result("Get User Notifications", False, f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        print_result("Get User Notifications", False, f"Exception: {str(e)}")
        return False

def test_send_reminders():
    """Test POST /api/rsvp/send-reminders - Trigger 24-hour reminders"""
    print("⏰ Testing Send RSVP Reminders...")
    
    url = f"{BASE_URL}/rsvp/send-reminders"
    
    try:
        response = requests.post(url)
        if response.status_code == 200:
            reminder_data = response.json()
            if "message" in reminder_data:
                print_result("Send RSVP Reminders", True, reminder_data["message"])
                return True
            else:
                print_result("Send RSVP Reminders", False, "Response missing 'message' field")
                return False
        else:
            print_result("Send RSVP Reminders", False, f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        print_result("Send RSVP Reminders", False, f"Exception: {str(e)}")
        return False

def test_cancel_rsvp(user_id, event_id):
    """Test DELETE /api/rsvp/{user_id}/{event_id} - Cancel RSVP"""
    print("🗑️ Testing RSVP Cancellation...")
    
    url = f"{BASE_URL}/rsvp/{user_id}/{event_id}"
    
    try:
        response = requests.delete(url)
        if response.status_code == 200:
            cancel_data = response.json()
            if "message" in cancel_data:
                print_result("Cancel RSVP", True, cancel_data["message"])
                return True
            else:
                print_result("Cancel RSVP", False, "Response missing 'message' field")
                return False
        else:
            print_result("Cancel RSVP", False, f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        print_result("Cancel RSVP", False, f"Exception: {str(e)}")
        return False

def main():
    """Main testing function"""
    print("🚗 Oklahoma Car Events - RSVP and Notification System Testing")
    print("=" * 70)
    print()
    
    # Step 1: Login as admin
    user_id = test_admin_login()
    if not user_id:
        print("❌ Cannot proceed without admin login")
        sys.exit(1)
    
    # Step 2: Get an existing event
    event_id = test_get_events()
    if not event_id:
        print("❌ Cannot proceed without existing events")
        sys.exit(1)
    
    # Step 3: Create RSVP
    rsvp_created = test_create_rsvp(user_id, event_id)
    if not rsvp_created:
        print("❌ RSVP creation failed - testing other endpoints anyway")
    
    # Step 4: Check RSVP status
    has_rsvp = test_check_rsvp(user_id, event_id)
    if rsvp_created and not has_rsvp:
        print("⚠️ RSVP was created but check shows hasRsvp: false")
    
    # Step 5: Get user RSVPs
    test_get_user_rsvps(user_id)
    
    # Step 6: Get user notifications (should show RSVP confirmation)
    test_get_notifications(user_id)
    
    # Step 7: Test reminder system
    test_send_reminders()
    
    # Step 8: Cancel RSVP
    if rsvp_created:
        cancel_success = test_cancel_rsvp(user_id, event_id)
        
        # Verify cancellation
        if cancel_success:
            print("🔍 Verifying RSVP cancellation...")
            has_rsvp_after_cancel = test_check_rsvp(user_id, event_id)
            if has_rsvp_after_cancel:
                print_result("RSVP Cancel Verification", False, "RSVP still shows as active after cancellation")
            else:
                print_result("RSVP Cancel Verification", True, "RSVP successfully cancelled")
    
    print("=" * 70)
    print("🏁 RSVP and Notification System Testing Complete!")

if __name__ == "__main__":
    main()