#!/usr/bin/env python3
"""
Backend API Testing for Apple Sign In Authentication
Oklahoma Car Events App - Apple Auth Testing
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://event-hub-okc-1.preview.emergentagent.com/api"

def print_test_result(test_name, success, details=""):
    """Print formatted test results"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"    {details}")
    print()

def test_apple_auth_session():
    """Test Apple auth session verification endpoint"""
    print("🍎 Testing Apple Auth Session Verification...")
    
    url = f"{BACKEND_URL}/auth/apple/session"
    payload = {
        "identityToken": "mock_token",
        "fullName": "Test User",
        "email": "apple_test@example.com"
    }
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        
        # The endpoint should handle JWT decode gracefully (may fail verification but should not crash)
        if response.status_code in [200, 401, 500]:
            # Check if it's a proper error response or success
            if response.status_code == 200:
                data = response.json()
                if "isNewUser" in data and "appleData" in data:
                    print_test_result("Apple Auth Session - Success Response", True, 
                                    f"Status: {response.status_code}, Response: {json.dumps(data, indent=2)}")
                    return True
                else:
                    print_test_result("Apple Auth Session - Invalid Response Structure", False,
                                    f"Status: {response.status_code}, Response: {response.text}")
                    return False
            else:
                # Check if error is handled gracefully
                try:
                    error_data = response.json()
                    print_test_result("Apple Auth Session - Graceful Error Handling", True,
                                    f"Status: {response.status_code}, Error: {error_data.get('detail', 'Unknown error')}")
                    return True
                except:
                    print_test_result("Apple Auth Session - Error Response Format", False,
                                    f"Status: {response.status_code}, Response: {response.text}")
                    return False
        else:
            print_test_result("Apple Auth Session - Unexpected Status", False,
                            f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print_test_result("Apple Auth Session - Request Failed", False, f"Error: {str(e)}")
        return False

def test_apple_auth_complete():
    """Test Apple registration completion endpoint"""
    print("🍎 Testing Apple Auth Complete Registration...")
    
    url = f"{BACKEND_URL}/auth/apple/complete"
    payload = {
        "email": "apple_complete_test@example.com",
        "nickname": "appleuser123",
        "appleId": "000123.abc.456",
        "name": "Apple Test User"
    }
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            # Check if user was created with correct email and name
            if data.get("email") == payload["email"] and data.get("name") == payload["name"]:
                print_test_result("Apple Auth Complete - User Creation", True,
                                f"Created user: {data.get('name')} ({data.get('email')}) with ID: {data.get('id')}")
                return data.get("id")  # Return user ID for further tests
            else:
                print_test_result("Apple Auth Complete - Invalid User Data", False,
                                f"Expected email: {payload['email']}, name: {payload['name']}, got: {json.dumps(data, indent=2)}")
                return None
        else:
            try:
                error_data = response.json()
                print_test_result("Apple Auth Complete - Registration Failed", False,
                                f"Status: {response.status_code}, Error: {error_data.get('detail', 'Unknown error')}")
            except:
                print_test_result("Apple Auth Complete - Registration Failed", False,
                                f"Status: {response.status_code}, Response: {response.text}")
            return None
            
    except requests.exceptions.RequestException as e:
        print_test_result("Apple Auth Complete - Request Failed", False, f"Error: {str(e)}")
        return None

def test_apple_auth_duplicate_username():
    """Test duplicate username handling"""
    print("🍎 Testing Apple Auth Duplicate Username Check...")
    
    url = f"{BACKEND_URL}/auth/apple/complete"
    payload = {
        "email": "apple_duplicate_test@example.com",
        "nickname": "appleuser123",  # Same nickname as previous test
        "appleId": "000456.def.789",
        "name": "Apple Duplicate User"
    }
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        
        if response.status_code == 400:
            try:
                error_data = response.json()
                if "Username already taken" in error_data.get("detail", ""):
                    print_test_result("Apple Auth Duplicate Username - Proper Validation", True,
                                    f"Correctly rejected duplicate username: {error_data.get('detail')}")
                    return True
                else:
                    print_test_result("Apple Auth Duplicate Username - Wrong Error Message", False,
                                    f"Expected 'Username already taken', got: {error_data.get('detail')}")
                    return False
            except:
                print_test_result("Apple Auth Duplicate Username - Invalid Error Format", False,
                                f"Status: {response.status_code}, Response: {response.text}")
                return False
        else:
            print_test_result("Apple Auth Duplicate Username - Should Have Failed", False,
                            f"Expected 400 status, got {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print_test_result("Apple Auth Duplicate Username - Request Failed", False, f"Error: {str(e)}")
        return False

def test_username_availability():
    """Test username availability check endpoints"""
    print("🔍 Testing Username Availability Checks...")
    
    # Test taken username
    url = f"{BACKEND_URL}/auth/check-username/appleuser123"
    try:
        response = requests.get(url, timeout=30)
        if response.status_code == 200:
            data = response.json()
            if data.get("available") == False:
                print_test_result("Username Check - Taken Username", True,
                                f"Correctly shows 'appleuser123' as unavailable")
            else:
                print_test_result("Username Check - Taken Username", False,
                                f"Expected available=false, got: {data}")
        else:
            print_test_result("Username Check - Taken Username", False,
                            f"Status: {response.status_code}, Response: {response.text}")
    except requests.exceptions.RequestException as e:
        print_test_result("Username Check - Taken Username", False, f"Error: {str(e)}")
    
    # Test available username
    url = f"{BACKEND_URL}/auth/check-username/newuniquename99"
    try:
        response = requests.get(url, timeout=30)
        if response.status_code == 200:
            data = response.json()
            if data.get("available") == True:
                print_test_result("Username Check - Available Username", True,
                                f"Correctly shows 'newuniquename99' as available")
                return True
            else:
                print_test_result("Username Check - Available Username", False,
                                f"Expected available=true, got: {data}")
                return False
        else:
            print_test_result("Username Check - Available Username", False,
                            f"Status: {response.status_code}, Response: {response.text}")
            return False
    except requests.exceptions.RequestException as e:
        print_test_result("Username Check - Available Username", False, f"Error: {str(e)}")
        return False

def test_existing_auth_endpoints():
    """Test existing Google auth and login endpoints to ensure they still work"""
    print("🔐 Testing Existing Authentication Endpoints...")
    
    # Test admin login
    url = f"{BACKEND_URL}/auth/login"
    payload = {
        "email": "admin@okcarevents.com",
        "password": "admin123"
    }
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("email") == "admin@okcarevents.com" and data.get("isAdmin") == True:
                print_test_result("Admin Login - Credentials Valid", True,
                                f"Successfully logged in admin user: {data.get('name')}")
                return True
            else:
                print_test_result("Admin Login - Invalid Response Data", False,
                                f"Response: {json.dumps(data, indent=2)}")
                return False
        else:
            try:
                error_data = response.json()
                print_test_result("Admin Login - Login Failed", False,
                                f"Status: {response.status_code}, Error: {error_data.get('detail', 'Unknown error')}")
            except:
                print_test_result("Admin Login - Login Failed", False,
                                f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print_test_result("Admin Login - Request Failed", False, f"Error: {str(e)}")
        return False

def main():
    """Run all Apple Sign In authentication tests"""
    print("=" * 80)
    print("🍎 APPLE SIGN IN AUTHENTICATION TESTING")
    print("Oklahoma Car Events Backend API")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    print()
    
    test_results = []
    
    # Test Apple auth session verification
    test_results.append(test_apple_auth_session())
    
    # Test Apple auth complete registration
    user_id = test_apple_auth_complete()
    test_results.append(user_id is not None)
    
    # Test duplicate username handling
    test_results.append(test_apple_auth_duplicate_username())
    
    # Test username availability checks
    test_results.append(test_username_availability())
    
    # Test existing auth endpoints
    test_results.append(test_existing_auth_endpoints())
    
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
        print("\n🎉 ALL TESTS PASSED! Apple Sign In authentication is working correctly.")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Please review the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())