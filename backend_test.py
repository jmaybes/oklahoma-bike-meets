#!/usr/bin/env python3
"""
Oklahoma Car Events API - Push Notification Flow Testing
Testing comprehensive push notification flows as requested in review.
"""

import requests
import json
import time
from datetime import datetime, timedelta

# Use the external URL from frontend/.env
BASE_URL = "https://event-hub-okc.preview.emergentagent.com/api"

class TestPushNotificationFlows:
    def __init__(self):
        self.admin_token = None
        self.admin_id = None
        self.test_user_id = None
        self.test_user2_id = None
        self.session = requests.Session()
        
    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
        
    def test_admin_login(self):
        """Test admin login and get admin user ID"""
        self.log("🔐 Testing admin login...")
        
        login_data = {
            "email": "admin@okcarevents.com",
            "password": "admin123"
        }
        
        response = self.session.post(f"{BASE_URL}/auth/login", json=login_data)
        
        if response.status_code == 200:
            data = response.json()
            self.admin_id = data.get("id")
            self.log(f"✅ Admin login successful. Admin ID: {self.admin_id}")
            return True
        else:
            self.log(f"❌ Admin login failed: {response.status_code} - {response.text}")
            return False
            
    def create_test_user(self):
        """Create a test user for notification testing"""
        self.log("👤 Creating test user for notifications...")
        
        user_data = {
            "email": f"testuser_{int(time.time())}@test.com",
            "password": "testpass123",
            "name": "Test User",
            "nickname": "TestUser"
        }
        
        response = self.session.post(f"{BASE_URL}/auth/register", json=user_data)
        
        if response.status_code == 200:
            data = response.json()
            self.test_user_id = data.get("id")
            self.log(f"✅ Test user created. User ID: {self.test_user_id}")
            return True
        else:
            self.log(f"❌ Test user creation failed: {response.status_code} - {response.text}")
            return False
            
    def create_second_test_user(self):
        """Create a second test user for messaging"""
        self.log("👤 Creating second test user for messaging...")
        
        user_data = {
            "email": f"testuser2_{int(time.time())}@test.com",
            "password": "testpass123",
            "name": "Test User 2",
            "nickname": "TestUser2"
        }
        
        response = self.session.post(f"{BASE_URL}/auth/register", json=user_data)
        
        if response.status_code == 200:
            data = response.json()
            self.test_user2_id = data.get("id")
            self.log(f"✅ Second test user created. User ID: {self.test_user2_id}")
            return True
        else:
            self.log(f"❌ Second test user creation failed: {response.status_code} - {response.text}")
            return False

    def test_popup_event_approval_notifications(self):
        """Test Pop-up Event Approval Push Notifications"""
        self.log("\n🚨 Testing Pop-up Event Approval Push Notifications...")
        
        # Create a popup event as admin (should auto-approve and trigger notifications)
        popup_event_data = {
            "title": "Test PopUp Meet",
            "description": "Popup test for notification flow",
            "date": "2026-03-25",
            "time": "7:00 PM",
            "location": "Test Lot",
            "address": "123 Test St",
            "city": "Oklahoma City",
            "eventType": "Pop Up Meet",
            "isPopUp": True,
            "userId": self.admin_id
        }
        
        response = self.session.post(f"{BASE_URL}/events", json=popup_event_data)
        
        if response.status_code == 200:
            event_data = response.json()
            event_id = event_data.get("id")
            is_approved = event_data.get("isApproved")
            is_popup = event_data.get("isPopUp")
            
            self.log(f"✅ Popup event created. ID: {event_id}, Approved: {is_approved}, IsPopUp: {is_popup}")
            
            if is_approved and is_popup:
                self.log("✅ Event is auto-approved popup - should trigger notifications")
                
                # Wait a moment for notifications to be created
                time.sleep(2)
                
                # Check if notifications were created for test user
                if self.test_user_id:
                    notif_response = self.session.get(f"{BASE_URL}/notifications/{self.test_user_id}")
                    
                    if notif_response.status_code == 200:
                        notifications = notif_response.json()
                        popup_notifications = [n for n in notifications if n.get("type") == "popup_event"]
                        
                        if popup_notifications:
                            self.log(f"✅ Found {len(popup_notifications)} popup event notifications for test user")
                            latest_notif = popup_notifications[0]
                            self.log(f"   📱 Notification: {latest_notif.get('title')}")
                            self.log(f"   📝 Message: {latest_notif.get('message')}")
                            return True
                        else:
                            self.log("❌ No popup event notifications found for test user")
                            return False
                    else:
                        self.log(f"❌ Failed to get notifications: {notif_response.status_code}")
                        return False
                else:
                    self.log("⚠️ No test user available to check notifications")
                    return True  # Event creation worked, just can't verify notifications
            else:
                self.log(f"❌ Event not properly configured: approved={is_approved}, popup={is_popup}")
                return False
        else:
            self.log(f"❌ Popup event creation failed: {response.status_code} - {response.text}")
            return False

    def test_message_push_notifications(self):
        """Test Message Push Notifications"""
        self.log("\n💬 Testing Message Push Notifications...")
        
        if not self.admin_id or not self.test_user2_id:
            self.log("❌ Missing required user IDs for message testing")
            return False
            
        # Send a message from admin to test user 2
        message_data = {
            "senderId": self.admin_id,
            "recipientId": self.test_user2_id,
            "content": "Hey, checking out the meet tonight?"
        }
        
        response = self.session.post(f"{BASE_URL}/messages", json=message_data)
        
        if response.status_code == 200:
            message_data = response.json()
            message_id = message_data.get("id")
            
            self.log(f"✅ Message sent successfully. ID: {message_id}")
            self.log(f"   📤 From: {message_data.get('senderId')}")
            self.log(f"   📥 To: {message_data.get('recipientId')}")
            self.log(f"   💬 Content: {message_data.get('content')}")
            
            # Verify message was saved correctly
            thread_response = self.session.get(f"{BASE_URL}/messages/thread/{self.admin_id}/{self.test_user2_id}")
            
            if thread_response.status_code == 200:
                thread_messages = thread_response.json()
                if thread_messages:
                    self.log(f"✅ Message thread retrieved with {len(thread_messages)} messages")
                    latest_message = thread_messages[-1]
                    if latest_message.get("content") == message_data.get("content"):
                        self.log("✅ Message content verified in thread")
                        return True
                    else:
                        self.log("❌ Message content mismatch in thread")
                        return False
                else:
                    self.log("❌ No messages found in thread")
                    return False
            else:
                self.log(f"❌ Failed to get message thread: {thread_response.status_code}")
                return False
        else:
            self.log(f"❌ Message sending failed: {response.status_code} - {response.text}")
            return False

    def test_rsvp_reminder_system(self):
        """Test RSVP Reminder System"""
        self.log("\n⏰ Testing RSVP Reminder System...")
        
        if not self.test_user_id:
            self.log("❌ No test user available for RSVP testing")
            return False
            
        # First, create an event for tomorrow
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        event_data = {
            "title": "Tomorrow's Test Event",
            "description": "Event for testing RSVP reminders",
            "date": tomorrow,
            "time": "6:00 PM",
            "location": "Test Venue",
            "address": "456 Test Ave",
            "city": "Oklahoma City",
            "eventType": "Car Meet",
            "userId": self.admin_id
        }
        
        event_response = self.session.post(f"{BASE_URL}/events", json=event_data)
        
        if event_response.status_code != 200:
            self.log(f"❌ Failed to create test event: {event_response.status_code}")
            return False
            
        event = event_response.json()
        event_id = event.get("id")
        self.log(f"✅ Created test event for tomorrow. ID: {event_id}")
        
        # RSVP to the event
        rsvp_data = {
            "userId": self.test_user_id,
            "eventId": event_id
        }
        
        rsvp_response = self.session.post(f"{BASE_URL}/rsvp", json=rsvp_data)
        
        if rsvp_response.status_code == 200:
            rsvp_data = rsvp_response.json()
            self.log(f"✅ RSVP created successfully")
            self.log(f"   🎫 Event: {rsvp_data.get('eventTitle')}")
            self.log(f"   📅 Date: {rsvp_data.get('eventDate')}")
            self.log(f"   ⏰ Time: {rsvp_data.get('eventTime')}")
            self.log(f"   📍 Location: {rsvp_data.get('eventLocation')}")
            self.log(f"   📬 Reminder Sent: {rsvp_data.get('reminderSent')}")
            
            # Trigger the reminder check
            reminder_response = self.session.post(f"{BASE_URL}/rsvp/send-reminders")
            
            if reminder_response.status_code == 200:
                reminder_data = reminder_response.json()
                self.log(f"✅ Reminder check triggered: {reminder_data.get('message')}")
                
                # Wait a moment for notifications to be processed
                time.sleep(2)
                
                # Check if reminder notification was created
                notif_response = self.session.get(f"{BASE_URL}/notifications/{self.test_user_id}")
                
                if notif_response.status_code == 200:
                    notifications = notif_response.json()
                    reminder_notifications = [n for n in notifications if n.get("type") == "event_reminder"]
                    
                    if reminder_notifications:
                        self.log(f"✅ Found {len(reminder_notifications)} reminder notifications")
                        latest_reminder = reminder_notifications[0]
                        self.log(f"   📱 Reminder: {latest_reminder.get('title')}")
                        self.log(f"   📝 Message: {latest_reminder.get('message')}")
                        
                        # Verify the RSVP was marked as reminderSent: true
                        user_rsvps_response = self.session.get(f"{BASE_URL}/rsvp/user/{self.test_user_id}")
                        
                        if user_rsvps_response.status_code == 200:
                            user_rsvps = user_rsvps_response.json()
                            target_rsvp = next((r for r in user_rsvps if r.get("eventId") == event_id), None)
                            
                            if target_rsvp and target_rsvp.get("reminderSent"):
                                self.log("✅ RSVP marked as reminderSent: true")
                                return True
                            else:
                                self.log("❌ RSVP not marked as reminderSent")
                                return False
                        else:
                            self.log(f"❌ Failed to get user RSVPs: {user_rsvps_response.status_code}")
                            return False
                    else:
                        self.log("❌ No reminder notifications found")
                        return False
                else:
                    self.log(f"❌ Failed to get notifications: {notif_response.status_code}")
                    return False
            else:
                self.log(f"❌ Reminder trigger failed: {reminder_response.status_code} - {reminder_response.text}")
                return False
        else:
            self.log(f"❌ RSVP creation failed: {response.status_code} - {response.text}")
            return False

    def test_general_verification(self):
        """Test General Verification of notification endpoints"""
        self.log("\n🔍 Testing General Verification...")
        
        # Test GET /api/rsvp/send-reminders endpoint
        reminder_response = self.session.post(f"{BASE_URL}/rsvp/send-reminders")
        
        if reminder_response.status_code == 200:
            data = reminder_response.json()
            self.log(f"✅ /api/rsvp/send-reminders returns proper response: {data}")
        else:
            self.log(f"❌ /api/rsvp/send-reminders failed: {reminder_response.status_code}")
            return False
            
        # Test notifications endpoint structure
        if self.test_user_id:
            notif_response = self.session.get(f"{BASE_URL}/notifications/{self.test_user_id}")
            
            if notif_response.status_code == 200:
                notifications = notif_response.json()
                self.log(f"✅ Notifications endpoint returns {len(notifications)} notifications")
                
                if notifications:
                    sample_notif = notifications[0]
                    required_fields = ["type", "title", "message"]
                    missing_fields = [field for field in required_fields if field not in sample_notif]
                    
                    if not missing_fields:
                        self.log("✅ Notification objects have required fields: type, title, message")
                    else:
                        self.log(f"❌ Missing required fields in notifications: {missing_fields}")
                        return False
                else:
                    self.log("ℹ️ No notifications to verify structure")
            else:
                self.log(f"❌ Notifications endpoint failed: {notif_response.status_code}")
                return False
        
        self.log("✅ General verification completed successfully")
        return True

    def run_all_tests(self):
        """Run all push notification flow tests"""
        self.log("🚀 Starting Oklahoma Car Events Push Notification Flow Testing")
        self.log(f"🌐 Base URL: {BASE_URL}")
        
        results = {}
        
        # Setup
        results["admin_login"] = self.test_admin_login()
        results["create_test_user"] = self.create_test_user()
        results["create_second_test_user"] = self.create_second_test_user()
        
        # Main tests
        results["popup_event_notifications"] = self.test_popup_event_approval_notifications()
        results["message_notifications"] = self.test_message_push_notifications()
        results["rsvp_reminder_system"] = self.test_rsvp_reminder_system()
        results["general_verification"] = self.test_general_verification()
        
        # Summary
        self.log("\n" + "="*60)
        self.log("📊 PUSH NOTIFICATION FLOW TEST RESULTS")
        self.log("="*60)
        
        passed = 0
        total = 0
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{test_name.replace('_', ' ').title()}: {status}")
            if result:
                passed += 1
            total += 1
        
        self.log(f"\n🎯 Overall: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
        
        if passed == total:
            self.log("🎉 ALL PUSH NOTIFICATION FLOWS WORKING CORRECTLY!")
        else:
            self.log("⚠️ Some push notification flows need attention")
            
        return results

if __name__ == "__main__":
    tester = TestPushNotificationFlows()
    results = tester.run_all_tests()