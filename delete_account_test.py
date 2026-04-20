#!/usr/bin/env python3
"""
Backend API Testing for DELETE Account Endpoint
Oklahoma Car Events App - Account Deletion Testing
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://github-check-4.preview.emergentagent.com/api"

def print_test_result(test_name, success, details=""):
    """Print formatted test results"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"    {details}")
    print()

def get_admin_user():
    """Get admin user details for testing"""
    print("🔍 Getting admin user details...")
    
    # First login to get admin user data
    url = f"{BACKEND_URL}/auth/login"
    payload = {
        "email": "admin@okcarevents.com",
        "password": "admin123"
    }
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        if response.status_code == 200:
            admin_data = response.json()
            print_test_result("Admin Login", True, f"Admin ID: {admin_data.get('id')}")
            return admin_data
        else:
            print_test_result("Admin Login", False, f"Status: {response.status_code}")
            return None
    except requests.exceptions.RequestException as e:
        print_test_result("Admin Login", False, f"Error: {str(e)}")
        return None

def create_test_user():
    """Create a test user for deletion testing"""
    print("👤 Creating test user for deletion...")
    
    url = f"{BACKEND_URL}/auth/register"
    payload = {
        "email": "testdelete@test.com",
        "name": "Test Delete",
        "nickname": "testdelete",
        "password": "test123"
    }
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        if response.status_code == 200:
            user_data = response.json()
            print_test_result("Test User Creation", True, 
                            f"Created user: {user_data.get('name')} ({user_data.get('email')}) with ID: {user_data.get('id')}")
            return user_data
        else:
            try:
                error_data = response.json()
                print_test_result("Test User Creation", False,
                                f"Status: {response.status_code}, Error: {error_data.get('detail', 'Unknown error')}")
            except:
                print_test_result("Test User Creation", False,
                                f"Status: {response.status_code}, Response: {response.text}")
            return None
    except requests.exceptions.RequestException as e:
        print_test_result("Test User Creation", False, f"Error: {str(e)}")
        return None

def test_username_check_before_deletion(username):
    """Test username availability check before deletion"""
    print(f"🔍 Testing username check before deletion: {username}")
    
    url = f"{BACKEND_URL}/auth/check-username/{username}"
    try:
        response = requests.get(url, timeout=30)
        if response.status_code == 200:
            data = response.json()
            if data.get("available") == False:
                print_test_result("Username Check Before Deletion", True,
                                f"Username '{username}' correctly shows as unavailable")
                return True
            else:
                print_test_result("Username Check Before Deletion", False,
                                f"Expected available=false, got: {data}")
                return False
        else:
            print_test_result("Username Check Before Deletion", False,
                            f"Status: {response.status_code}, Response: {response.text}")
            return False
    except requests.exceptions.RequestException as e:
        print_test_result("Username Check Before Deletion", False, f"Error: {str(e)}")
        return False

def test_delete_account_invalid_user_id():
    """Test DELETE account with invalid user_id"""
    print("❌ Testing DELETE account with invalid user_id...")
    
    url = f"{BACKEND_URL}/auth/delete-account"
    payload = {
        "user_id": "invalid_id",
        "email": "test@test.com",
        "password": "test123"
    }
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        if response.status_code == 400:
            try:
                error_data = response.json()
                if "Invalid user ID" in error_data.get("detail", ""):
                    print_test_result("DELETE Account - Invalid User ID", True,
                                    f"Correctly rejected invalid user ID: {error_data.get('detail')}")
                    return True
                else:
                    print_test_result("DELETE Account - Invalid User ID", False,
                                    f"Expected 'Invalid user ID', got: {error_data.get('detail')}")
                    return False
            except:
                print_test_result("DELETE Account - Invalid User ID", False,
                                f"Status: {response.status_code}, Response: {response.text}")
                return False
        else:
            print_test_result("DELETE Account - Invalid User ID", False,
                            f"Expected 400 status, got {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print_test_result("DELETE Account - Invalid User ID", False, f"Error: {str(e)}")
        return False

def test_delete_account_nonexistent_user():
    """Test DELETE account with non-existent valid ObjectId"""
    print("❌ Testing DELETE account with non-existent valid ObjectId...")
    
    url = f"{BACKEND_URL}/auth/delete-account"
    # Valid ObjectId format but non-existent
    payload = {
        "user_id": "507f1f77bcf86cd799439011",
        "email": "test@test.com",
        "password": "test123"
    }
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        if response.status_code == 404:
            try:
                error_data = response.json()
                if "User not found" in error_data.get("detail", ""):
                    print_test_result("DELETE Account - Non-existent User", True,
                                    f"Correctly returned 404 for non-existent user: {error_data.get('detail')}")
                    return True
                else:
                    print_test_result("DELETE Account - Non-existent User", False,
                                    f"Expected 'User not found', got: {error_data.get('detail')}")
                    return False
            except:
                print_test_result("DELETE Account - Non-existent User", False,
                                f"Status: {response.status_code}, Response: {response.text}")
                return False
        else:
            print_test_result("DELETE Account - Non-existent User", False,
                            f"Expected 404 status, got {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print_test_result("DELETE Account - Non-existent User", False, f"Error: {str(e)}")
        return False

def test_delete_account_wrong_email(admin_data):
    """Test DELETE account with wrong email for admin user"""
    print("❌ Testing DELETE account with wrong email for admin user...")
    
    url = f"{BACKEND_URL}/auth/delete-account"
    payload = {
        "user_id": admin_data["id"],
        "email": "wrong@email.com",  # Wrong email
        "password": "admin123"
    }
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        if response.status_code == 401:
            try:
                error_data = response.json()
                if "Email does not match" in error_data.get("detail", ""):
                    print_test_result("DELETE Account - Wrong Email", True,
                                    f"Correctly rejected wrong email: {error_data.get('detail')}")
                    return True
                else:
                    print_test_result("DELETE Account - Wrong Email", False,
                                    f"Expected 'Email does not match', got: {error_data.get('detail')}")
                    return False
            except:
                print_test_result("DELETE Account - Wrong Email", False,
                                f"Status: {response.status_code}, Response: {response.text}")
                return False
        else:
            print_test_result("DELETE Account - Wrong Email", False,
                            f"Expected 401 status, got {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print_test_result("DELETE Account - Wrong Email", False, f"Error: {str(e)}")
        return False

def test_delete_account_empty_fields():
    """Test DELETE account with empty fields"""
    print("❌ Testing DELETE account with empty fields...")
    
    url = f"{BACKEND_URL}/auth/delete-account"
    payload = {
        "user_id": "",
        "email": "",
        "password": ""
    }
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        if response.status_code in [400, 422]:
            try:
                error_data = response.json()
                print_test_result("DELETE Account - Empty Fields", True,
                                f"Correctly rejected empty fields (Status: {response.status_code}): {error_data.get('detail', 'Validation error')}")
                return True
            except:
                print_test_result("DELETE Account - Empty Fields", True,
                                f"Correctly rejected empty fields (Status: {response.status_code})")
                return True
        else:
            print_test_result("DELETE Account - Empty Fields", False,
                            f"Expected 400 or 422 status, got {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print_test_result("DELETE Account - Empty Fields", False, f"Error: {str(e)}")
        return False

def test_delete_account_success(test_user_data):
    """Test successful DELETE account for test user"""
    print("✅ Testing successful DELETE account for test user...")
    
    url = f"{BACKEND_URL}/auth/delete-account"
    payload = {
        "user_id": test_user_data["id"],
        "email": test_user_data["email"],
        "password": "test123"
    }
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        if response.status_code == 200:
            try:
                data = response.json()
                if "deleted" in data and "message" in data:
                    print_test_result("DELETE Account - Success", True,
                                    f"Successfully deleted account. Message: {data.get('message')}")
                    print(f"    Deleted counts: {json.dumps(data.get('deleted', {}), indent=6)}")
                    return True
                else:
                    print_test_result("DELETE Account - Success", False,
                                    f"Invalid response structure: {json.dumps(data, indent=2)}")
                    return False
            except:
                print_test_result("DELETE Account - Success", False,
                                f"Status: {response.status_code}, Response: {response.text}")
                return False
        else:
            try:
                error_data = response.json()
                print_test_result("DELETE Account - Success", False,
                                f"Status: {response.status_code}, Error: {error_data.get('detail', 'Unknown error')}")
            except:
                print_test_result("DELETE Account - Success", False,
                                f"Status: {response.status_code}, Response: {response.text}")
            return False
    except requests.exceptions.RequestException as e:
        print_test_result("DELETE Account - Success", False, f"Error: {str(e)}")
        return False

def test_username_check_after_deletion(username):
    """Test username availability check after deletion"""
    print(f"🔍 Testing username check after deletion: {username}")
    
    url = f"{BACKEND_URL}/auth/check-username/{username}"
    try:
        response = requests.get(url, timeout=30)
        if response.status_code == 200:
            data = response.json()
            if data.get("available") == True:
                print_test_result("Username Check After Deletion", True,
                                f"Username '{username}' correctly shows as available after deletion")
                return True
            else:
                print_test_result("Username Check After Deletion", False,
                                f"Expected available=true, got: {data}")
                return False
        else:
            print_test_result("Username Check After Deletion", False,
                            f"Status: {response.status_code}, Response: {response.text}")
            return False
    except requests.exceptions.RequestException as e:
        print_test_result("Username Check After Deletion", False, f"Error: {str(e)}")
        return False

def main():
    """Run all DELETE account endpoint tests"""
    print("=" * 80)
    print("🗑️  DELETE ACCOUNT ENDPOINT TESTING")
    print("Oklahoma Car Events Backend API")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    print()
    
    test_results = []
    
    # Get admin user data
    admin_data = get_admin_user()
    if not admin_data:
        print("❌ Cannot proceed without admin user data")
        return 1
    
    # Create test user for deletion
    test_user_data = create_test_user()
    if not test_user_data:
        print("❌ Cannot proceed without test user")
        return 1
    
    # Test username check before deletion
    test_results.append(test_username_check_before_deletion("testdelete"))
    
    # Test 1: Invalid user_id
    test_results.append(test_delete_account_invalid_user_id())
    
    # Test 2: Non-existent valid ObjectId
    test_results.append(test_delete_account_nonexistent_user())
    
    # Test 3: Wrong email for admin user
    test_results.append(test_delete_account_wrong_email(admin_data))
    
    # Test 4: Empty fields
    test_results.append(test_delete_account_empty_fields())
    
    # Test 5: Successful deletion of test user
    test_results.append(test_delete_account_success(test_user_data))
    
    # Test username check after deletion
    test_results.append(test_username_check_after_deletion("testdelete"))
    
    # Summary
    print("=" * 80)
    print("📊 TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(test_results)
    total = len(test_results)
    
    print(f"Total Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    print(f"Success Rate: {(passed/total)*100:.1f}%")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! DELETE account endpoint is working correctly.")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Please review the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())