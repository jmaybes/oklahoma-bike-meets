#!/usr/bin/env python3
"""
Backend Test Suite for Oklahoma Car Events API - Recurring Events Feature
Testing Agent - Comprehensive API Testing
"""

import requests
import json
from datetime import datetime, timedelta
import sys

# Configuration
BASE_URL = "https://drive-okc.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

def log_test(test_name, status, details=""):
    """Log test results with consistent formatting"""
    status_symbol = "✅" if status == "PASS" else "❌"
    print(f"{status_symbol} {test_name}")
    if details:
        print(f"   {details}")
    print()

def test_recurring_events():
    """Test the Recurring Events feature comprehensively"""
    print("=" * 80)
    print("TESTING: Recurring Events Feature")
    print("=" * 80)
    
    # Test 1: Create a Recurring Event (Saturday)
    print("Test 1: Create Recurring Event - Weekly Sunset Cruise (Saturday)")
    recurring_event_data = {
        "title": "Weekly Sunset Cruise",
        "description": "Weekly cruise through OKC every Saturday evening",
        "date": "2025-06-14",  # This is a Saturday
        "time": "6:00 PM",
        "location": "Route 66 Park",
        "address": "3500 NW 36th St",
        "city": "Oklahoma City",
        "organizer": "OKC Cruisers",
        "entryFee": "Free",
        "eventType": "Cruise",
        "carTypes": ["Classic", "Muscle"],
        "isRecurring": True,
        "recurrenceDay": 6,  # Saturday (0=Sunday, 6=Saturday)
        "recurrenceEndDate": "2025-08-30"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/events", json=recurring_event_data, headers=HEADERS)
        if response.status_code == 200:
            created_event = response.json()
            event_id = created_event["id"]
            log_test("Create Recurring Event (Saturday)", "PASS", 
                    f"Event created with ID: {event_id}, isRecurring: {created_event.get('isRecurring')}")
            
            # Test 2: Approve the Event for testing
            print("Test 2: Approve Recurring Event")
            approve_data = {"isApproved": True}
            approve_response = requests.put(f"{BASE_URL}/events/{event_id}", json=approve_data, headers=HEADERS)
            if approve_response.status_code == 200:
                log_test("Approve Recurring Event", "PASS", "Event approved successfully")
            else:
                log_test("Approve Recurring Event", "FAIL", f"Status: {approve_response.status_code}, Response: {approve_response.text}")
                
        else:
            log_test("Create Recurring Event (Saturday)", "FAIL", 
                    f"Status: {response.status_code}, Response: {response.text}")
            return
            
    except Exception as e:
        log_test("Create Recurring Event (Saturday)", "FAIL", f"Exception: {str(e)}")
        return
    
    # Test 3: Get Events and Verify Expansion
    print("Test 3: Get Events and Verify Recurring Event Expansion")
    try:
        response = requests.get(f"{BASE_URL}/events", headers=HEADERS)
        if response.status_code == 200:
            events = response.json()
            
            # Find recurring event instances
            recurring_instances = []
            for event in events:
                if event.get("parentEventId") == event_id:
                    recurring_instances.append(event)
            
            if recurring_instances:
                log_test("Recurring Event Expansion", "PASS", 
                        f"Found {len(recurring_instances)} recurring instances")
                
                # Verify instance structure
                first_instance = recurring_instances[0]
                expected_fields = ["id", "parentEventId", "date", "title", "description"]
                missing_fields = [field for field in expected_fields if field not in first_instance]
                
                if not missing_fields:
                    log_test("Instance Structure Validation", "PASS", 
                            f"All required fields present: {expected_fields}")
                    
                    # Verify ID format
                    instance_id = first_instance["id"]
                    if "__" in instance_id and len(instance_id.split("__")) == 2:
                        original_id, date_suffix = instance_id.split("__")
                        if original_id == event_id and len(date_suffix) == 8:
                            log_test("Instance ID Format", "PASS", 
                                    f"Correct format: {original_id}__{date_suffix}")
                        else:
                            log_test("Instance ID Format", "FAIL", 
                                    f"Invalid format: {instance_id}")
                    else:
                        log_test("Instance ID Format", "FAIL", 
                                f"Invalid format: {instance_id}")
                    
                    # Verify dates are Saturdays
                    saturday_count = 0
                    for instance in recurring_instances:
                        event_date = datetime.strptime(instance["date"], "%Y-%m-%d")
                        if event_date.weekday() == 5:  # Saturday in Python (0=Monday, 5=Saturday)
                            saturday_count += 1
                    
                    if saturday_count == len(recurring_instances):
                        log_test("Day Conversion Validation", "PASS", 
                                f"All {saturday_count} instances are on Saturday")
                    else:
                        log_test("Day Conversion Validation", "FAIL", 
                                f"Only {saturday_count}/{len(recurring_instances)} instances are on Saturday")
                        
                else:
                    log_test("Instance Structure Validation", "FAIL", 
                            f"Missing fields: {missing_fields}")
            else:
                log_test("Recurring Event Expansion", "FAIL", 
                        "No recurring instances found")
        else:
            log_test("Get Events for Expansion Check", "FAIL", 
                    f"Status: {response.status_code}, Response: {response.text}")
            
    except Exception as e:
        log_test("Get Events and Verify Expansion", "FAIL", f"Exception: {str(e)}")
    
    # Test 4: Create Monday Recurring Event
    print("Test 4: Create Recurring Event - Monday Car Meet")
    monday_event_data = {
        "title": "Monday Night Car Meet",
        "description": "Weekly car meet every Monday night",
        "date": "2025-06-16",  # This is a Monday
        "time": "7:00 PM",
        "location": "Walmart Parking Lot",
        "address": "1000 W Memorial Rd",
        "city": "Oklahoma City",
        "organizer": "Monday Night Cruisers",
        "entryFee": "Free",
        "eventType": "Car Meet",
        "carTypes": ["All"],
        "isRecurring": True,
        "recurrenceDay": 1,  # Monday (0=Sunday, 1=Monday)
        "recurrenceEndDate": "2025-08-25"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/events", json=monday_event_data, headers=HEADERS)
        if response.status_code == 200:
            monday_event = response.json()
            monday_event_id = monday_event["id"]
            log_test("Create Monday Recurring Event", "PASS", 
                    f"Event created with ID: {monday_event_id}")
            
            # Approve Monday event
            approve_data = {"isApproved": True}
            requests.put(f"{BASE_URL}/events/{monday_event_id}", json=approve_data, headers=HEADERS)
            
        else:
            log_test("Create Monday Recurring Event", "FAIL", 
                    f"Status: {response.status_code}, Response: {response.text}")
            monday_event_id = None
            
    except Exception as e:
        log_test("Create Monday Recurring Event", "FAIL", f"Exception: {str(e)}")
        monday_event_id = None
    
    # Test 5: Verify Monday instances
    if monday_event_id:
        print("Test 5: Verify Monday Recurring Event Expansion")
        try:
            response = requests.get(f"{BASE_URL}/events", headers=HEADERS)
            if response.status_code == 200:
                events = response.json()
                
                monday_instances = []
                for event in events:
                    if event.get("parentEventId") == monday_event_id:
                        monday_instances.append(event)
                
                if monday_instances:
                    # Verify dates are Mondays
                    monday_count = 0
                    for instance in monday_instances:
                        event_date = datetime.strptime(instance["date"], "%Y-%m-%d")
                        if event_date.weekday() == 0:  # Monday in Python (0=Monday)
                            monday_count += 1
                    
                    if monday_count == len(monday_instances):
                        log_test("Monday Day Conversion", "PASS", 
                                f"All {monday_count} instances are on Monday")
                    else:
                        log_test("Monday Day Conversion", "FAIL", 
                                f"Only {monday_count}/{len(monday_instances)} instances are on Monday")
                else:
                    log_test("Monday Recurring Event Expansion", "FAIL", 
                            "No Monday recurring instances found")
            else:
                log_test("Get Events for Monday Check", "FAIL", 
                        f"Status: {response.status_code}")
                
        except Exception as e:
            log_test("Verify Monday Instances", "FAIL", f"Exception: {str(e)}")
    
    # Test 6: Test Edge Case - No End Date (should default to 12 weeks)
    print("Test 6: Create Recurring Event with No End Date (Sunday)")
    sunday_event_data = {
        "title": "Sunday Funday Cruise",
        "description": "Weekly Sunday cruise with no end date",
        "date": "2025-06-15",  # This is a Sunday
        "time": "2:00 PM",
        "location": "Bricktown",
        "address": "1 E Sheridan Ave",
        "city": "Oklahoma City",
        "organizer": "Sunday Cruisers",
        "entryFee": "Free",
        "eventType": "Cruise",
        "carTypes": ["All"],
        "isRecurring": True,
        "recurrenceDay": 0  # Sunday (0=Sunday)
        # No recurrenceEndDate - should default to 12 weeks
    }
    
    try:
        response = requests.post(f"{BASE_URL}/events", json=sunday_event_data, headers=HEADERS)
        if response.status_code == 200:
            sunday_event = response.json()
            sunday_event_id = sunday_event["id"]
            log_test("Create Sunday Recurring Event (No End Date)", "PASS", 
                    f"Event created with ID: {sunday_event_id}")
            
            # Approve Sunday event
            approve_data = {"isApproved": True}
            requests.put(f"{BASE_URL}/events/{sunday_event_id}", json=approve_data, headers=HEADERS)
            
            # Check expansion
            response = requests.get(f"{BASE_URL}/events", headers=HEADERS)
            if response.status_code == 200:
                events = response.json()
                sunday_instances = [e for e in events if e.get("parentEventId") == sunday_event_id]
                
                if sunday_instances:
                    # Should have approximately 12 instances (12 weeks default)
                    instance_count = len(sunday_instances)
                    if 10 <= instance_count <= 14:  # Allow some flexibility
                        log_test("Default 12-Week Generation", "PASS", 
                                f"Generated {instance_count} instances (expected ~12)")
                    else:
                        log_test("Default 12-Week Generation", "FAIL", 
                                f"Generated {instance_count} instances (expected ~12)")
                    
                    # Verify all are Sundays
                    sunday_count = 0
                    for instance in sunday_instances:
                        event_date = datetime.strptime(instance["date"], "%Y-%m-%d")
                        if event_date.weekday() == 6:  # Sunday in Python (6=Sunday)
                            sunday_count += 1
                    
                    if sunday_count == len(sunday_instances):
                        log_test("Sunday Day Conversion", "PASS", 
                                f"All {sunday_count} instances are on Sunday")
                    else:
                        log_test("Sunday Day Conversion", "FAIL", 
                                f"Only {sunday_count}/{len(sunday_instances)} instances are on Sunday")
                else:
                    log_test("Sunday Recurring Event Expansion", "FAIL", 
                            "No Sunday recurring instances found")
            
        else:
            log_test("Create Sunday Recurring Event (No End Date)", "FAIL", 
                    f"Status: {response.status_code}, Response: {response.text}")
            
    except Exception as e:
        log_test("Create Sunday Recurring Event (No End Date)", "FAIL", f"Exception: {str(e)}")
    
    print("=" * 80)
    print("RECURRING EVENTS TESTING COMPLETED")
    print("=" * 80)

def main():
    """Main test execution"""
    print("Oklahoma Car Events API - Recurring Events Testing")
    print("Testing Agent: Backend API Validation")
    print(f"Backend URL: {BASE_URL}")
    print(f"Test Time: {datetime.now().isoformat()}")
    print()
    
    # Test the recurring events feature
    test_recurring_events()

if __name__ == "__main__":
    main()