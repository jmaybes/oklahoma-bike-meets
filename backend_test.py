#!/usr/bin/env python3
"""
Performance Timer Backend Testing
Tests the new fields and improvements for the Oklahoma Car Events app.
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://event-hub-okc-1.preview.emergentagent.com/api"

class PerformanceTimerTester:
    def __init__(self):
        self.admin_id = None
        self.test_run_ids = []
        self.session = requests.Session()
        
    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
        
    def test_admin_login(self):
        """Step 1: Login as admin to get user ID"""
        self.log("🔐 Testing admin login...")
        
        login_data = {
            "email": "admin@okcarevents.com",
            "password": "admin123"
        }
        
        response = self.session.post(f"{BACKEND_URL}/auth/login", json=login_data)
        
        if response.status_code != 200:
            self.log(f"❌ Admin login failed: {response.status_code} - {response.text}")
            return False
            
        user_data = response.json()
        self.admin_id = user_data.get("id")
        
        if not self.admin_id:
            self.log("❌ Admin login successful but no user ID returned")
            return False
            
        self.log(f"✅ Admin login successful. User ID: {self.admin_id}")
        return True
        
    def test_create_0_60_run_with_new_fields(self):
        """Step 2: Create 0-60 run with NEW fields"""
        self.log("🏁 Testing 0-60 performance run creation with NEW fields...")
        
        run_data = {
            "userId": self.admin_id,
            "carInfo": "2024 Mustang GT",
            "zeroToSixty": 4.25,
            "topSpeed": 65.3,
            "isManualEntry": True,
            "location": "Thunder Valley"
        }
        
        response = self.session.post(f"{BACKEND_URL}/performance-runs", json=run_data)
        
        if response.status_code != 200:
            self.log(f"❌ 0-60 run creation failed: {response.status_code} - {response.text}")
            return False
            
        run_result = response.json()
        run_id = run_result.get("id")
        
        if not run_id:
            self.log("❌ 0-60 run created but no ID returned")
            return False
            
        self.test_run_ids.append(run_id)
        
        # Verify NEW fields are present in response
        required_new_fields = ["topSpeed", "isManualEntry", "location"]
        missing_fields = []
        
        for field in required_new_fields:
            if field not in run_result:
                missing_fields.append(field)
                
        if missing_fields:
            self.log(f"❌ 0-60 run missing NEW fields: {missing_fields}")
            return False
            
        # Verify field values
        if run_result["topSpeed"] != 65.3:
            self.log(f"❌ topSpeed mismatch: expected 65.3, got {run_result['topSpeed']}")
            return False
            
        if run_result["isManualEntry"] != True:
            self.log(f"❌ isManualEntry mismatch: expected True, got {run_result['isManualEntry']}")
            return False
            
        if run_result["location"] != "Thunder Valley":
            self.log(f"❌ location mismatch: expected 'Thunder Valley', got '{run_result['location']}'")
            return False
            
        self.log(f"✅ 0-60 run created successfully with NEW fields. ID: {run_id}")
        self.log(f"   - topSpeed: {run_result['topSpeed']}")
        self.log(f"   - isManualEntry: {run_result['isManualEntry']}")
        self.log(f"   - location: {run_result['location']}")
        return True
        
    def test_create_quarter_mile_run_with_new_fields(self):
        """Step 3: Create quarter-mile run with NEW fields"""
        self.log("🏁 Testing quarter-mile performance run creation with NEW fields...")
        
        run_data = {
            "userId": self.admin_id,
            "carInfo": "2024 Mustang GT",
            "quarterMile": 12.50,
            "quarterMileSpeed": 112.3,
            "topSpeed": 115.0,
            "isManualEntry": False,
            "location": "OKC Raceway"
        }
        
        response = self.session.post(f"{BACKEND_URL}/performance-runs", json=run_data)
        
        if response.status_code != 200:
            self.log(f"❌ Quarter-mile run creation failed: {response.status_code} - {response.text}")
            return False
            
        run_result = response.json()
        run_id = run_result.get("id")
        
        if not run_id:
            self.log("❌ Quarter-mile run created but no ID returned")
            return False
            
        self.test_run_ids.append(run_id)
        
        # Verify NEW fields are present in response
        required_new_fields = ["quarterMileSpeed", "topSpeed", "isManualEntry", "location"]
        missing_fields = []
        
        for field in required_new_fields:
            if field not in run_result:
                missing_fields.append(field)
                
        if missing_fields:
            self.log(f"❌ Quarter-mile run missing NEW fields: {missing_fields}")
            return False
            
        # Verify field values
        if run_result["quarterMileSpeed"] != 112.3:
            self.log(f"❌ quarterMileSpeed mismatch: expected 112.3, got {run_result['quarterMileSpeed']}")
            return False
            
        if run_result["topSpeed"] != 115.0:
            self.log(f"❌ topSpeed mismatch: expected 115.0, got {run_result['topSpeed']}")
            return False
            
        if run_result["isManualEntry"] != False:
            self.log(f"❌ isManualEntry mismatch: expected False, got {run_result['isManualEntry']}")
            return False
            
        if run_result["location"] != "OKC Raceway":
            self.log(f"❌ location mismatch: expected 'OKC Raceway', got '{run_result['location']}'")
            return False
            
        self.log(f"✅ Quarter-mile run created successfully with NEW fields. ID: {run_id}")
        self.log(f"   - quarterMileSpeed: {run_result['quarterMileSpeed']}")
        self.log(f"   - topSpeed: {run_result['topSpeed']}")
        self.log(f"   - isManualEntry: {run_result['isManualEntry']}")
        self.log(f"   - location: {run_result['location']}")
        return True
        
    def test_personal_bests(self):
        """Step 4: Fetch personal bests"""
        self.log("📊 Testing personal bests endpoint...")
        
        response = self.session.get(f"{BACKEND_URL}/performance-runs/user/{self.admin_id}/best")
        
        if response.status_code != 200:
            self.log(f"❌ Personal bests fetch failed: {response.status_code} - {response.text}")
            return False
            
        bests = response.json()
        
        # Verify required fields
        required_fields = ["zeroToSixty", "zeroToHundred", "quarterMile", "totalRuns"]
        missing_fields = []
        
        for field in required_fields:
            if field not in bests:
                missing_fields.append(field)
                
        if missing_fields:
            self.log(f"❌ Personal bests missing fields: {missing_fields}")
            return False
            
        # Verify we have at least the runs we just created (plus any existing ones)
        if bests["totalRuns"] < 2:
            self.log(f"❌ Expected at least 2 total runs, got {bests['totalRuns']}")
            return False
            
        # Verify our quarter mile time is present (should be the best since we're the only one with quarter mile data)
        if bests["quarterMile"] != 12.50:
            self.log(f"❌ Expected quarterMile 12.50, got {bests['quarterMile']}")
            return False
            
        # For 0-60, just verify we have a valid time (could be existing data or our new data)
        if bests["zeroToSixty"] is None:
            self.log("❌ Expected zeroToSixty to have a value")
            return False
            
        # Log what we found for verification
        self.log(f"   Note: Found existing 0-60 best time: {bests['zeroToSixty']} (may be better than our test data)")
            
        self.log(f"✅ Personal bests retrieved successfully:")
        self.log(f"   - zeroToSixty: {bests['zeroToSixty']}")
        self.log(f"   - zeroToHundred: {bests['zeroToHundred']}")
        self.log(f"   - quarterMile: {bests['quarterMile']}")
        self.log(f"   - totalRuns: {bests['totalRuns']}")
        return True
        
    def test_0_60_leaderboard_new_fields(self):
        """Step 5: Fetch 0-60 leaderboard and verify new fields"""
        self.log("🏆 Testing 0-60 leaderboard with NEW fields...")
        
        response = self.session.get(f"{BACKEND_URL}/leaderboard/0-60")
        
        if response.status_code != 200:
            self.log(f"❌ 0-60 leaderboard fetch failed: {response.status_code} - {response.text}")
            return False
            
        leaderboard = response.json()
        
        if not isinstance(leaderboard, list):
            self.log(f"❌ Expected leaderboard to be a list, got {type(leaderboard)}")
            return False
            
        if len(leaderboard) == 0:
            self.log("❌ Leaderboard is empty")
            return False
            
        # Find our entry
        our_entry = None
        for entry in leaderboard:
            if entry.get("userId") == self.admin_id and entry.get("time") == 4.25:
                our_entry = entry
                break
                
        if not our_entry:
            self.log("❌ Could not find our 0-60 entry in leaderboard")
            return False
            
        # Verify NEW fields are present
        required_new_fields = ["topSpeed", "isManualEntry", "location"]
        missing_fields = []
        
        for field in required_new_fields:
            if field not in our_entry:
                missing_fields.append(field)
                
        if missing_fields:
            self.log(f"❌ 0-60 leaderboard entry missing NEW fields: {missing_fields}")
            return False
            
        self.log(f"✅ 0-60 leaderboard includes NEW fields:")
        self.log(f"   - topSpeed: {our_entry['topSpeed']}")
        self.log(f"   - isManualEntry: {our_entry['isManualEntry']}")
        self.log(f"   - location: {our_entry['location']}")
        return True
        
    def test_quarter_mile_leaderboard_new_fields(self):
        """Step 6: Fetch quarter-mile leaderboard and verify new fields"""
        self.log("🏆 Testing quarter-mile leaderboard with NEW fields...")
        
        response = self.session.get(f"{BACKEND_URL}/leaderboard/quarter-mile")
        
        if response.status_code != 200:
            self.log(f"❌ Quarter-mile leaderboard fetch failed: {response.status_code} - {response.text}")
            return False
            
        leaderboard = response.json()
        
        if not isinstance(leaderboard, list):
            self.log(f"❌ Expected leaderboard to be a list, got {type(leaderboard)}")
            return False
            
        if len(leaderboard) == 0:
            self.log("❌ Quarter-mile leaderboard is empty")
            return False
            
        # Find our entry
        our_entry = None
        for entry in leaderboard:
            if entry.get("userId") == self.admin_id and entry.get("time") == 12.50:
                our_entry = entry
                break
                
        if not our_entry:
            self.log("❌ Could not find our quarter-mile entry in leaderboard")
            return False
            
        # Verify quarterMileSpeed field is present
        if "quarterMileSpeed" not in our_entry:
            self.log("❌ Quarter-mile leaderboard entry missing quarterMileSpeed field")
            return False
            
        if our_entry["quarterMileSpeed"] != 112.3:
            self.log(f"❌ quarterMileSpeed mismatch: expected 112.3, got {our_entry['quarterMileSpeed']}")
            return False
            
        self.log(f"✅ Quarter-mile leaderboard includes quarterMileSpeed: {our_entry['quarterMileSpeed']}")
        return True
        
    def test_user_runs_new_fields(self):
        """Step 7: Fetch user runs and verify new fields"""
        self.log("📋 Testing user runs with NEW fields...")
        
        response = self.session.get(f"{BACKEND_URL}/performance-runs/user/{self.admin_id}")
        
        if response.status_code != 200:
            self.log(f"❌ User runs fetch failed: {response.status_code} - {response.text}")
            return False
            
        runs = response.json()
        
        if not isinstance(runs, list):
            self.log(f"❌ Expected runs to be a list, got {type(runs)}")
            return False
            
        if len(runs) < 2:
            self.log(f"❌ Expected at least 2 runs, got {len(runs)}")
            return False
            
        # Check that all runs include new fields
        for i, run in enumerate(runs):
            required_new_fields = ["topSpeed", "isManualEntry", "location"]
            missing_fields = []
            
            for field in required_new_fields:
                if field not in run:
                    missing_fields.append(field)
                    
            if missing_fields:
                self.log(f"❌ Run {i+1} missing NEW fields: {missing_fields}")
                return False
                
        self.log(f"✅ All {len(runs)} user runs include NEW fields")
        return True
        
    def test_admin_edit_with_new_fields(self):
        """Step 8: Test admin edit with new fields"""
        self.log("✏️ Testing admin edit with NEW fields...")
        
        if not self.test_run_ids:
            self.log("❌ No test run IDs available for editing")
            return False
            
        run_id = self.test_run_ids[1]  # Use the quarter-mile run
        
        update_data = {
            "quarterMileSpeed": 115.0,
            "topSpeed": 120.0
        }
        
        response = self.session.put(
            f"{BACKEND_URL}/admin/performance-runs/{run_id}?admin_id={self.admin_id}",
            json=update_data
        )
        
        if response.status_code != 200:
            self.log(f"❌ Admin edit failed: {response.status_code} - {response.text}")
            return False
            
        updated_run = response.json()
        
        # Verify the updates
        if updated_run.get("quarterMileSpeed") != 115.0:
            self.log(f"❌ quarterMileSpeed not updated: expected 115.0, got {updated_run.get('quarterMileSpeed')}")
            return False
            
        if updated_run.get("topSpeed") != 120.0:
            self.log(f"❌ topSpeed not updated: expected 120.0, got {updated_run.get('topSpeed')}")
            return False
            
        self.log(f"✅ Admin edit successful:")
        self.log(f"   - quarterMileSpeed updated to: {updated_run['quarterMileSpeed']}")
        self.log(f"   - topSpeed updated to: {updated_run['topSpeed']}")
        return True
        
    def cleanup_test_runs(self):
        """Step 9: Clean up test runs"""
        self.log("🧹 Cleaning up test runs...")
        
        success_count = 0
        for run_id in self.test_run_ids:
            response = self.session.delete(
                f"{BACKEND_URL}/admin/performance-runs/{run_id}?admin_id={self.admin_id}"
            )
            
            if response.status_code == 200:
                success_count += 1
                self.log(f"   ✅ Deleted run {run_id}")
            else:
                self.log(f"   ❌ Failed to delete run {run_id}: {response.status_code}")
                
        self.log(f"✅ Cleanup complete: {success_count}/{len(self.test_run_ids)} runs deleted")
        return success_count == len(self.test_run_ids)
        
    def run_all_tests(self):
        """Run all performance timer tests"""
        self.log("🚀 Starting Performance Timer Backend Testing...")
        self.log(f"Backend URL: {BACKEND_URL}")
        
        tests = [
            ("Admin Login", self.test_admin_login),
            ("Create 0-60 Run with NEW Fields", self.test_create_0_60_run_with_new_fields),
            ("Create Quarter-Mile Run with NEW Fields", self.test_create_quarter_mile_run_with_new_fields),
            ("Personal Bests", self.test_personal_bests),
            ("0-60 Leaderboard NEW Fields", self.test_0_60_leaderboard_new_fields),
            ("Quarter-Mile Leaderboard NEW Fields", self.test_quarter_mile_leaderboard_new_fields),
            ("User Runs NEW Fields", self.test_user_runs_new_fields),
            ("Admin Edit with NEW Fields", self.test_admin_edit_with_new_fields),
            ("Cleanup", self.cleanup_test_runs)
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            self.log(f"\n{'='*60}")
            self.log(f"Running: {test_name}")
            self.log('='*60)
            
            try:
                if test_func():
                    passed += 1
                    self.log(f"✅ {test_name} PASSED")
                else:
                    failed += 1
                    self.log(f"❌ {test_name} FAILED")
            except Exception as e:
                failed += 1
                self.log(f"❌ {test_name} FAILED with exception: {str(e)}")
                
        self.log(f"\n{'='*60}")
        self.log(f"PERFORMANCE TIMER TESTING COMPLETE")
        self.log(f"{'='*60}")
        self.log(f"✅ Passed: {passed}")
        self.log(f"❌ Failed: {failed}")
        self.log(f"📊 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        
        return failed == 0

if __name__ == "__main__":
    tester = PerformanceTimerTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)