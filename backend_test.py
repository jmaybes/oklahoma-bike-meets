#!/usr/bin/env python3
"""
Co-Leader Functionality Testing for Crews API
Tests the complete Co-Leader workflow as specified in the review request.
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://event-hub-okc-1.preview.emergentagent.com/api"

class CrewsCoLeaderTester:
    def __init__(self):
        self.admin_token = None
        self.admin_user_id = None
        self.test_user_token = None
        self.test_user_id = None
        self.third_user_token = None
        self.third_user_id = None
        self.crew_id = None
        self.invite_id = None
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"    Details: {details}")
        print()
    
    def make_request(self, method, endpoint, data=None, headers=None, expected_status=None):
        """Make HTTP request with error handling"""
        url = f"{BACKEND_URL}{endpoint}"
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=headers)
            elif method.upper() == "PUT":
                response = requests.put(url, json=data, headers=headers)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            if expected_status and response.status_code != expected_status:
                return None, f"Expected status {expected_status}, got {response.status_code}: {response.text}"
            
            return response, None
        except Exception as e:
            return None, f"Request failed: {str(e)}"
    
    def test_1_admin_login(self):
        """Test 1: Login as admin"""
        data = {
            "email": "admin@okcarevents.com",
            "password": "admin123"
        }
        
        response, error = self.make_request("POST", "/auth/login", data, expected_status=200)
        if error:
            self.log_test("1. Admin Login", False, error)
            return False
        
        try:
            result = response.json()
            self.admin_token = result.get("token")
            self.admin_user_id = result.get("user", {}).get("id")
            
            if not self.admin_token or not self.admin_user_id:
                self.log_test("1. Admin Login", False, "Missing token or user_id in response")
                return False
            
            self.log_test("1. Admin Login", True, f"Admin logged in successfully. User ID: {self.admin_user_id}")
            return True
        except Exception as e:
            self.log_test("1. Admin Login", False, f"Failed to parse response: {str(e)}")
            return False
    
    def test_2_create_crew(self):
        """Test 2: Create a crew"""
        if not self.admin_token:
            self.log_test("2. Create Crew", False, "No admin token available")
            return False
        
        data = {"name": "CoLeader Test Crew"}
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        response, error = self.make_request("POST", "/crews", data, headers, expected_status=200)
        if error:
            self.log_test("2. Create Crew", False, error)
            return False
        
        try:
            result = response.json()
            self.crew_id = result.get("crew", {}).get("id")
            
            if not self.crew_id:
                self.log_test("2. Create Crew", False, "Missing crew ID in response")
                return False
            
            self.log_test("2. Create Crew", True, f"Crew created successfully. Crew ID: {self.crew_id}")
            return True
        except Exception as e:
            self.log_test("2. Create Crew", False, f"Failed to parse response: {str(e)}")
            return False
    
    def test_3_register_test_user(self):
        """Test 3: Register a test user"""
        import time
        timestamp = str(int(time.time()))
        data = {
            "name": "Co Leader Test",
            "email": f"coleadertest{timestamp}@test.com",
            "password": "test123",
            "nickname": f"CoLeadUser{timestamp}"
        }
        
        response, error = self.make_request("POST", "/auth/register", data, expected_status=200)
        if error:
            self.log_test("3. Register Test User", False, error)
            return False
        
        try:
            result = response.json()
            self.test_user_id = result.get("id")  # Direct access to id, not user.id
            
            # Now login to get token
            login_data = {"email": f"coleadertest{timestamp}@test.com", "password": "test123"}
            login_response, login_error = self.make_request("POST", "/auth/login", login_data, expected_status=200)
            
            if login_error:
                self.log_test("3. Register Test User", False, f"Registration succeeded but login failed: {login_error}")
                return False
            
            login_result = login_response.json()
            self.test_user_token = login_result.get("token")
            
            if not self.test_user_id or not self.test_user_token:
                self.log_test("3. Register Test User", False, "Missing user ID or token")
                return False
            
            self.log_test("3. Register Test User", True, f"Test user registered and logged in. User ID: {self.test_user_id}")
            return True
        except Exception as e:
            self.log_test("3. Register Test User", False, f"Failed to parse response: {str(e)}")
            return False
    
    def test_4_invite_test_user(self):
        """Test 4: Invite test user to crew"""
        if not self.admin_token or not self.crew_id or not self.test_user_id:
            self.log_test("4. Invite Test User", False, "Missing required data")
            return False
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        endpoint = f"/crews/{self.crew_id}/invite/{self.test_user_id}"
        
        response, error = self.make_request("POST", endpoint, None, headers, expected_status=200)
        if error:
            self.log_test("4. Invite Test User", False, error)
            return False
        
        self.log_test("4. Invite Test User", True, "Invite sent successfully")
        return True
    
    def test_5_accept_invite(self):
        """Test 5: Accept invite"""
        if not self.test_user_token or not self.test_user_id:
            self.log_test("5. Accept Invite", False, "Missing test user data")
            return False
        
        # First get pending invites
        response, error = self.make_request("GET", f"/crews/invites/pending/{self.test_user_id}")
        if error:
            self.log_test("5. Accept Invite", False, f"Failed to get pending invites: {error}")
            return False
        
        try:
            invites = response.json()
            if not invites:
                self.log_test("5. Accept Invite", False, "No pending invites found")
                return False
            
            self.invite_id = invites[0]["id"]
            
            # Accept the invite
            headers = {"Authorization": f"Bearer {self.test_user_token}"}
            accept_response, accept_error = self.make_request("PUT", f"/crews/invites/{self.invite_id}/accept", None, headers, expected_status=200)
            
            if accept_error:
                self.log_test("5. Accept Invite", False, f"Failed to accept invite: {accept_error}")
                return False
            
            self.log_test("5. Accept Invite", True, f"Invite accepted successfully. Invite ID: {self.invite_id}")
            return True
        except Exception as e:
            self.log_test("5. Accept Invite", False, f"Failed to parse response: {str(e)}")
            return False
    
    def test_6_verify_crew_members(self):
        """Test 6: Verify crew has 2 members"""
        if not self.crew_id:
            self.log_test("6. Verify Crew Members", False, "Missing crew ID")
            return False
        
        response, error = self.make_request("GET", f"/crews/{self.crew_id}")
        if error:
            self.log_test("6. Verify Crew Members", False, error)
            return False
        
        try:
            crew = response.json()
            members = crew.get("members", [])
            member_count = crew.get("memberCount", 0)
            
            if member_count != 2:
                self.log_test("6. Verify Crew Members", False, f"Expected 2 members, got {member_count}")
                return False
            
            # Find test user in members
            test_user_member = None
            for member in members:
                if member["id"] == self.test_user_id:
                    test_user_member = member
                    break
            
            if not test_user_member:
                self.log_test("6. Verify Crew Members", False, "Test user not found in crew members")
                return False
            
            if test_user_member["role"] != "Member":
                self.log_test("6. Verify Crew Members", False, f"Test user role is '{test_user_member['role']}', expected 'Member'")
                return False
            
            self.log_test("6. Verify Crew Members", True, f"Crew has 2 members, test user has role 'Member'")
            return True
        except Exception as e:
            self.log_test("6. Verify Crew Members", False, f"Failed to parse response: {str(e)}")
            return False
    
    def test_7_promote_to_co_leader(self):
        """Test 7: Promote to co-leader"""
        if not self.admin_token or not self.crew_id or not self.test_user_id:
            self.log_test("7. Promote to Co-Leader", False, "Missing required data")
            return False
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        endpoint = f"/crews/{self.crew_id}/co-leader/{self.test_user_id}"
        
        response, error = self.make_request("PUT", endpoint, None, headers, expected_status=200)
        if error:
            self.log_test("7. Promote to Co-Leader", False, error)
            return False
        
        self.log_test("7. Promote to Co-Leader", True, "User promoted to co-leader successfully")
        return True
    
    def test_8_verify_co_leader_role(self):
        """Test 8: Verify co-leader role"""
        if not self.crew_id or not self.test_user_id:
            self.log_test("8. Verify Co-Leader Role", False, "Missing required data")
            return False
        
        response, error = self.make_request("GET", f"/crews/{self.crew_id}")
        if error:
            self.log_test("8. Verify Co-Leader Role", False, error)
            return False
        
        try:
            crew = response.json()
            members = crew.get("members", [])
            co_leaders = crew.get("coLeaders", [])
            
            # Check if test user is in co-leaders list
            if self.test_user_id not in co_leaders:
                self.log_test("8. Verify Co-Leader Role", False, "Test user not found in co-leaders list")
                return False
            
            # Find test user in members and check role
            test_user_member = None
            for member in members:
                if member["id"] == self.test_user_id:
                    test_user_member = member
                    break
            
            if not test_user_member:
                self.log_test("8. Verify Co-Leader Role", False, "Test user not found in crew members")
                return False
            
            if test_user_member["role"] != "Co-Leader":
                self.log_test("8. Verify Co-Leader Role", False, f"Test user role is '{test_user_member['role']}', expected 'Co-Leader'")
                return False
            
            if not test_user_member.get("isCoLeader"):
                self.log_test("8. Verify Co-Leader Role", False, "Test user isCoLeader flag is not true")
                return False
            
            self.log_test("8. Verify Co-Leader Role", True, "Test user has Co-Leader role and isCoLeader: true")
            return True
        except Exception as e:
            self.log_test("8. Verify Co-Leader Role", False, f"Failed to parse response: {str(e)}")
            return False
    
    def test_9_co_leader_can_invite(self):
        """Test 9: Test co-leader can invite"""
        # First register another user
        import time
        timestamp = str(int(time.time()))
        data = {
            "name": "Third User",
            "email": f"thirduser{timestamp}@test.com",
            "password": "test123",
            "nickname": f"ThirdGuy{timestamp}"
        }
        
        response, error = self.make_request("POST", "/auth/register", data, expected_status=200)
        if error:
            self.log_test("9. Co-Leader Can Invite", False, f"Failed to register third user: {error}")
            return False
        
        try:
            result = response.json()
            self.third_user_id = result.get("id")  # Direct access to id, not user.id
            
            if not self.third_user_id:
                self.log_test("9. Co-Leader Can Invite", False, "Missing third user ID")
                return False
            
            # Now test co-leader can invite using test user's token (not admin's)
            if not self.test_user_token or not self.crew_id:
                self.log_test("9. Co-Leader Can Invite", False, "Missing test user token or crew ID")
                return False
            
            headers = {"Authorization": f"Bearer {self.test_user_token}"}
            endpoint = f"/crews/{self.crew_id}/invite/{self.third_user_id}"
            
            invite_response, invite_error = self.make_request("POST", endpoint, None, headers, expected_status=200)
            if invite_error:
                self.log_test("9. Co-Leader Can Invite", False, f"Co-leader invite failed: {invite_error}")
                return False
            
            self.log_test("9. Co-Leader Can Invite", True, f"Co-leader successfully invited third user. Third user ID: {self.third_user_id}")
            return True
        except Exception as e:
            self.log_test("9. Co-Leader Can Invite", False, f"Failed to parse response: {str(e)}")
            return False
    
    def test_10_demote_co_leader(self):
        """Test 10: Demote co-leader"""
        if not self.admin_token or not self.crew_id or not self.test_user_id:
            self.log_test("10. Demote Co-Leader", False, "Missing required data")
            return False
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        endpoint = f"/crews/{self.crew_id}/co-leader/{self.test_user_id}"
        
        response, error = self.make_request("DELETE", endpoint, None, headers, expected_status=200)
        if error:
            self.log_test("10. Demote Co-Leader", False, error)
            return False
        
        self.log_test("10. Demote Co-Leader", True, "Co-leader demoted successfully")
        return True
    
    def test_11_verify_demoted(self):
        """Test 11: Verify demoted"""
        if not self.crew_id or not self.test_user_id:
            self.log_test("11. Verify Demoted", False, "Missing required data")
            return False
        
        response, error = self.make_request("GET", f"/crews/{self.crew_id}")
        if error:
            self.log_test("11. Verify Demoted", False, error)
            return False
        
        try:
            crew = response.json()
            members = crew.get("members", [])
            co_leaders = crew.get("coLeaders", [])
            
            # Check if test user is NOT in co-leaders list
            if self.test_user_id in co_leaders:
                self.log_test("11. Verify Demoted", False, "Test user still found in co-leaders list")
                return False
            
            # Find test user in members and check role
            test_user_member = None
            for member in members:
                if member["id"] == self.test_user_id:
                    test_user_member = member
                    break
            
            if not test_user_member:
                self.log_test("11. Verify Demoted", False, "Test user not found in crew members")
                return False
            
            if test_user_member["role"] != "Member":
                self.log_test("11. Verify Demoted", False, f"Test user role is '{test_user_member['role']}', expected 'Member'")
                return False
            
            self.log_test("11. Verify Demoted", True, "Test user is back to 'Member' role")
            return True
        except Exception as e:
            self.log_test("11. Verify Demoted", False, f"Failed to parse response: {str(e)}")
            return False
    
    def test_12_non_creator_cant_promote(self):
        """Test 12: Test non-creator can't promote"""
        if not self.test_user_token or not self.crew_id or not self.test_user_id:
            self.log_test("12. Non-Creator Can't Promote", False, "Missing required data")
            return False
        
        # Test user tries to promote themselves using their own token
        headers = {"Authorization": f"Bearer {self.test_user_token}"}
        endpoint = f"/crews/{self.crew_id}/co-leader/{self.test_user_id}"
        
        response, error = self.make_request("PUT", endpoint, None, headers, expected_status=403)
        if error:
            self.log_test("12. Non-Creator Can't Promote", False, error)
            return False
        
        self.log_test("12. Non-Creator Can't Promote", True, "Non-creator correctly received 403 error when trying to promote")
        return True
    
    def test_13_cleanup(self):
        """Test 13: Cleanup - Delete crew"""
        if not self.admin_token or not self.crew_id:
            self.log_test("13. Cleanup", False, "Missing required data")
            return False
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        endpoint = f"/crews/{self.crew_id}"
        
        response, error = self.make_request("DELETE", endpoint, None, headers, expected_status=200)
        if error:
            self.log_test("13. Cleanup", False, error)
            return False
        
        self.log_test("13. Cleanup", True, "Crew deleted successfully")
        return True
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("=" * 60)
        print("CO-LEADER FUNCTIONALITY TESTING")
        print("=" * 60)
        print()
        
        tests = [
            self.test_1_admin_login,
            self.test_2_create_crew,
            self.test_3_register_test_user,
            self.test_4_invite_test_user,
            self.test_5_accept_invite,
            self.test_6_verify_crew_members,
            self.test_7_promote_to_co_leader,
            self.test_8_verify_co_leader_role,
            self.test_9_co_leader_can_invite,
            self.test_10_demote_co_leader,
            self.test_11_verify_demoted,
            self.test_12_non_creator_cant_promote,
            self.test_13_cleanup
        ]
        
        passed = 0
        failed = 0
        
        for test in tests:
            success = test()
            if success:
                passed += 1
            else:
                failed += 1
        
        print("=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {len(tests)}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {(passed/len(tests)*100):.1f}%")
        print()
        
        if failed > 0:
            print("FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"❌ {result['test']}: {result['details']}")
        else:
            print("🎉 ALL TESTS PASSED!")
        
        return failed == 0

if __name__ == "__main__":
    tester = CrewsCoLeaderTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)