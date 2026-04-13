#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Oklahoma Car Events
Testing Crews API endpoints as specified in review request
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://event-hub-okc-1.preview.emergentagent.com/api"

class CrewsAPITester:
    def __init__(self):
        self.admin_token = None
        self.admin_user_id = None
        self.test_user_token = None
        self.test_user_id = None
        self.crew_id = None
        self.invite_id = None
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
            "details": details
        })
        
    def test_admin_login(self):
        """Test 1: Login as admin to get JWT token"""
        try:
            response = requests.post(f"{BACKEND_URL}/auth/login", json={
                "email": "admin@okcarevents.com",
                "password": "admin123"
            })
            
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data.get("token")
                self.admin_user_id = data.get("user", {}).get("id")
                
                if self.admin_token and self.admin_user_id:
                    self.log_test("Admin Login", True, f"Token obtained, User ID: {self.admin_user_id}")
                    return True
                else:
                    self.log_test("Admin Login", False, "Token or user ID missing from response")
                    return False
            else:
                self.log_test("Admin Login", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Admin Login", False, f"Exception: {str(e)}")
            return False
    
    def test_create_crew(self):
        """Test 2: Create a crew"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.post(f"{BACKEND_URL}/crews", 
                json={"name": "OKC Street Kings"}, 
                headers=headers
            )
            
            if response.status_code in [200, 201]:
                data = response.json()
                crew = data.get("crew", {})
                self.crew_id = crew.get("id") or crew.get("_id")
                
                if self.crew_id:
                    self.log_test("Create Crew", True, f"Crew created with ID: {self.crew_id}")
                    return True
                else:
                    self.log_test("Create Crew", False, "Crew ID missing from response")
                    return False
            else:
                self.log_test("Create Crew", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Create Crew", False, f"Exception: {str(e)}")
            return False
    
    def test_create_second_crew_should_fail(self):
        """Test 3: Try creating a second crew (should FAIL - limit 1 per user)"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.post(f"{BACKEND_URL}/crews", 
                json={"name": "Second Crew"}, 
                headers=headers
            )
            
            if response.status_code == 400:
                response_text = response.text.lower()
                if "only create one crew" in response_text or "can only create one" in response_text:
                    self.log_test("Create Second Crew (Should Fail)", True, "Correctly rejected with 400 - one crew limit enforced")
                    return True
                else:
                    self.log_test("Create Second Crew (Should Fail)", False, f"Wrong error message: {response.text}")
                    return False
            else:
                self.log_test("Create Second Crew (Should Fail)", False, f"Expected 400 but got {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Create Second Crew (Should Fail)", False, f"Exception: {str(e)}")
            return False
    
    def test_get_crew_details(self):
        """Test 4: Get crew details"""
        try:
            response = requests.get(f"{BACKEND_URL}/crews/{self.crew_id}")
            
            if response.status_code == 200:
                data = response.json()
                members = data.get("members", [])
                
                if len(members) >= 1 and any(member.get("id") == self.admin_user_id for member in members):
                    self.log_test("Get Crew Details", True, f"Crew has {len(members)} members including creator")
                    return True
                else:
                    self.log_test("Get Crew Details", False, f"Creator not found in members list: {members}")
                    return False
            else:
                self.log_test("Get Crew Details", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Crew Details", False, f"Exception: {str(e)}")
            return False
    
    def test_get_user_crews(self):
        """Test 5: Get user's crews"""
        try:
            response = requests.get(f"{BACKEND_URL}/crews/user/{self.admin_user_id}")
            
            if response.status_code == 200:
                crews = response.json()
                
                if isinstance(crews, list) and len(crews) == 1:
                    crew = crews[0]
                    if crew.get("name") == "OKC Street Kings":
                        self.log_test("Get User Crews", True, f"Found 1 crew: {crew.get('name')}")
                        return True
                    else:
                        self.log_test("Get User Crews", False, f"Wrong crew name: {crew.get('name')}")
                        return False
                else:
                    self.log_test("Get User Crews", False, f"Expected 1 crew but got {len(crews) if isinstance(crews, list) else 'non-list'}")
                    return False
            else:
                self.log_test("Get User Crews", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get User Crews", False, f"Exception: {str(e)}")
            return False
    
    def test_register_second_user(self):
        """Test 6: Register a second user for invite testing"""
        try:
            # Use timestamp to make email unique
            import time
            timestamp = str(int(time.time()))
            unique_email = f"testcrewuser{timestamp}@test.com"
            unique_nickname = f"TestCrew{timestamp}"
            
            response = requests.post(f"{BACKEND_URL}/auth/register", json={
                "name": "Test User",
                "email": unique_email,
                "password": "test123",
                "nickname": unique_nickname
            })
            
            if response.status_code in [200, 201]:
                data = response.json()
                self.test_user_id = data.get("id")
                
                # Login to get token
                login_response = requests.post(f"{BACKEND_URL}/auth/login", json={
                    "email": unique_email,
                    "password": "test123"
                })
                
                if login_response.status_code == 200:
                    login_data = login_response.json()
                    self.test_user_token = login_data.get("token")
                    self.test_user_id = login_data.get("user", {}).get("id")
                    
                    if self.test_user_id and self.test_user_token:
                        self.log_test("Register Second User", True, f"User ID: {self.test_user_id}")
                        return True
                    else:
                        self.log_test("Register Second User", False, "Missing user ID or token")
                        return False
                else:
                    self.log_test("Register Second User", False, f"Login failed: {login_response.status_code}")
                    return False
            else:
                self.log_test("Register Second User", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Register Second User", False, f"Exception: {str(e)}")
            return False
    
    def test_send_invite(self):
        """Test 7: Send invite from admin to test user"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.post(f"{BACKEND_URL}/crews/{self.crew_id}/invite/{self.test_user_id}", 
                headers=headers
            )
            
            if response.status_code in [200, 201]:
                self.log_test("Send Invite", True, "Invite sent successfully")
                return True
            else:
                self.log_test("Send Invite", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Send Invite", False, f"Exception: {str(e)}")
            return False
    
    def test_get_pending_invites(self):
        """Test 8: Get pending invites for test user"""
        try:
            response = requests.get(f"{BACKEND_URL}/crews/invites/pending/{self.test_user_id}")
            
            if response.status_code == 200:
                invites = response.json()
                
                if isinstance(invites, list) and len(invites) == 1:
                    invite = invites[0]
                    self.invite_id = invite.get("id")
                    
                    if invite.get("crewName") == "OKC Street Kings":
                        self.log_test("Get Pending Invites", True, f"Found 1 pending invite for crew: {invite.get('crewName')}")
                        return True
                    else:
                        self.log_test("Get Pending Invites", False, f"Wrong crew name in invite: {invite.get('crewName')}")
                        return False
                else:
                    self.log_test("Get Pending Invites", False, f"Expected 1 invite but got {len(invites) if isinstance(invites, list) else 'non-list'}")
                    return False
            else:
                self.log_test("Get Pending Invites", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Pending Invites", False, f"Exception: {str(e)}")
            return False
    
    def test_accept_invite(self):
        """Test 9: Accept invite using test user's token"""
        try:
            headers = {"Authorization": f"Bearer {self.test_user_token}"}
            response = requests.put(f"{BACKEND_URL}/crews/invites/{self.invite_id}/accept", 
                headers=headers
            )
            
            if response.status_code == 200:
                self.log_test("Accept Invite", True, "Invite accepted successfully")
                return True
            else:
                self.log_test("Accept Invite", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Accept Invite", False, f"Exception: {str(e)}")
            return False
    
    def test_verify_crew_has_two_members(self):
        """Test 10: Verify crew now has 2 members"""
        try:
            response = requests.get(f"{BACKEND_URL}/crews/{self.crew_id}")
            
            if response.status_code == 200:
                data = response.json()
                members = data.get("members", [])
                member_count = data.get("memberCount", len(members))
                
                if member_count == 2:
                    member_ids = [member.get("id") for member in members]
                    if self.admin_user_id in member_ids and self.test_user_id in member_ids:
                        self.log_test("Verify Crew Has Two Members", True, f"Crew has {member_count} members as expected")
                        return True
                    else:
                        self.log_test("Verify Crew Has Two Members", False, f"Wrong member IDs: {member_ids}")
                        return False
                else:
                    self.log_test("Verify Crew Has Two Members", False, f"Expected 2 members but got {member_count}")
                    return False
            else:
                self.log_test("Verify Crew Has Two Members", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Verify Crew Has Two Members", False, f"Exception: {str(e)}")
            return False
    
    def test_leave_crew(self):
        """Test 11: Leave crew as test user"""
        try:
            headers = {"Authorization": f"Bearer {self.test_user_token}"}
            response = requests.delete(f"{BACKEND_URL}/crews/{self.crew_id}/members/{self.test_user_id}", 
                headers=headers
            )
            
            if response.status_code == 200:
                self.log_test("Leave Crew", True, "Successfully left crew")
                return True
            else:
                self.log_test("Leave Crew", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Leave Crew", False, f"Exception: {str(e)}")
            return False
    
    def test_delete_crew(self):
        """Test 12: Delete crew as admin"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.delete(f"{BACKEND_URL}/crews/{self.crew_id}", 
                headers=headers
            )
            
            if response.status_code == 200:
                self.log_test("Delete Crew", True, "Crew deleted successfully")
                return True
            else:
                self.log_test("Delete Crew", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Delete Crew", False, f"Exception: {str(e)}")
            return False
    
    def cleanup_test_user(self):
        """Test 13: Cleanup - note test user for manual cleanup"""
        try:
            # Note: In a real scenario, we would delete the test user
            # For now, just log that cleanup is needed
            self.log_test("Cleanup Test User", True, f"Test user {self.test_user_id} (testcrewuser@test.com) noted for cleanup")
            return True
        except Exception as e:
            self.log_test("Cleanup Test User", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all Crews API tests in sequence"""
        print("=" * 60)
        print("CREWS API TESTING - Oklahoma Car Events Backend")
        print("=" * 60)
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test started at: {datetime.now().isoformat()}")
        print()
        
        # Run tests in sequence - each depends on previous ones
        tests = [
            self.test_admin_login,
            self.test_create_crew,
            self.test_create_second_crew_should_fail,
            self.test_get_crew_details,
            self.test_get_user_crews,
            self.test_register_second_user,
            self.test_send_invite,
            self.test_get_pending_invites,
            self.test_accept_invite,
            self.test_verify_crew_has_two_members,
            self.test_leave_crew,
            self.test_delete_crew,
            self.cleanup_test_user
        ]
        
        for test in tests:
            success = test()
            if not success:
                print(f"\n⚠️  Test failed: {test.__name__}")
                print("Stopping test sequence due to failure.")
                break
            print()  # Add spacing between tests
        
        # Summary
        print("=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Tests Passed: {passed}/{total}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if passed == total:
            print("\n🎉 ALL CREWS API TESTS PASSED!")
            print("✅ Complete Crews API workflow verified successfully")
        else:
            print(f"\n❌ {total - passed} test(s) failed")
            print("Failed tests:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        print("=" * 60)
        return passed == total

def main():
    """Main test execution"""
    tester = CrewsAPITester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()