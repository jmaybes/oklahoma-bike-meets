#!/usr/bin/env python3

import asyncio
import aiohttp
import json
from datetime import datetime
import uuid

# Backend URL from frontend env
BASE_URL = "https://drive-okc.preview.emergentagent.com/api"

# Test data
TEST_USER_ID = str(uuid.uuid4())
TEST_USER_ID_2 = str(uuid.uuid4())  # For messaging
TEST_CAR_DATA = {
    "userId": TEST_USER_ID,
    "make": "Ford",
    "model": "Mustang",
    "year": "2024",
    "color": "Grabber Blue", 
    "modifications": "Cold air intake, exhaust",
    "description": "My daily driver",
    "photos": []
}

async def test_endpoint(session, method, endpoint, data=None, description=""):
    """Test an API endpoint and return the result"""
    url = f"{BASE_URL}{endpoint}"
    
    print(f"\n🔍 Testing {method} {endpoint}")
    print(f"📝 {description}")
    print(f"🌐 URL: {url}")
    
    if data:
        print(f"📤 Request data: {json.dumps(data, indent=2)}")
    
    try:
        async with session.request(method, url, json=data) as response:
            print(f"📊 Status: {response.status}")
            
            try:
                response_data = await response.json()
                print(f"📥 Response: {json.dumps(response_data, indent=2)}")
                return response.status, response_data
            except:
                response_text = await response.text()
                print(f"📥 Response (text): {response_text}")
                return response.status, response_text
                
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return None, str(e)

async def main():
    print("=" * 80)
    print("🚗 MY GARAGE (USER CARS) & MESSAGING ENDPOINTS TEST")
    print("=" * 80)
    
    async with aiohttp.ClientSession() as session:
        
        # First, let's create test users for messaging
        print("\n" + "=" * 60)
        print("👤 CREATING TEST USERS FOR MESSAGING")
        print("=" * 60)
        
        user1_data = {
            "email": f"testuser1_{TEST_USER_ID[:8]}@example.com",
            "name": "John Doe",
            "password": "testpass123",
            "nickname": "JohnD"
        }
        
        user2_data = {
            "email": f"testuser2_{TEST_USER_ID_2[:8]}@example.com", 
            "name": "Jane Smith",
            "password": "testpass456",
            "nickname": "JaneS"
        }
        
        user1_status, user1_response = await test_endpoint(
            session, "POST", "/auth/register", user1_data,
            "Register first test user for messaging"
        )
        
        user2_status, user2_response = await test_endpoint(
            session, "POST", "/auth/register", user2_data,
            "Register second test user for messaging"
        )
        
        # Extract user IDs if successful
        if user1_status == 200 and isinstance(user1_response, dict):
            actual_user_id_1 = user1_response.get('id', TEST_USER_ID)
            TEST_CAR_DATA["userId"] = actual_user_id_1
        else:
            actual_user_id_1 = TEST_USER_ID
            
        if user2_status == 200 and isinstance(user2_response, dict):
            actual_user_id_2 = user2_response.get('id', TEST_USER_ID_2)
        else:
            actual_user_id_2 = TEST_USER_ID_2
        
        print("\n" + "=" * 60)
        print("🚗 USER CARS ENDPOINTS TESTING")
        print("=" * 60)
        
        # 1. Test POST /api/user-cars - Create a new user car
        car_status, car_response = await test_endpoint(
            session, "POST", "/user-cars", TEST_CAR_DATA,
            "Create a new user car with Ford Mustang 2024"
        )
        
        car_id = None
        if car_status == 200 and isinstance(car_response, dict):
            car_id = car_response.get('id')
            print(f"✅ Car created successfully with ID: {car_id}")
        else:
            print(f"❌ Failed to create car")
        
        # 2. Test GET /api/user-cars/user/{user_id} - Get user's car
        await test_endpoint(
            session, "GET", f"/user-cars/user/{actual_user_id_1}", None,
            "Get the car we just created"
        )
        
        # 3. Test PUT /api/user-cars/{car_id} - Update user's car
        if car_id:
            update_data = {"color": "Triple Yellow"}
            await test_endpoint(
                session, "PUT", f"/user-cars/{car_id}", update_data,
                "Update car color to Triple Yellow"
            )
            
            # Verify the update
            await test_endpoint(
                session, "GET", f"/user-cars/user/{actual_user_id_1}", None,
                "Verify color was updated to Triple Yellow"
            )
        else:
            print("❌ Skipping car update test - no car ID available")
        
        print("\n" + "=" * 60)
        print("💬 MESSAGING ENDPOINTS TESTING")
        print("=" * 60)
        
        # 4. Test POST /api/messages - Send a message
        message_data = {
            "senderId": actual_user_id_1,
            "recipientId": actual_user_id_2,
            "content": "Hey! Nice to meet you at the car meet!"
        }
        
        message_status, message_response = await test_endpoint(
            session, "POST", "/messages", message_data,
            "Send a message from user1 to user2"
        )
        
        # Send another message for conversation testing
        message_data_2 = {
            "senderId": actual_user_id_2,
            "recipientId": actual_user_id_1,
            "content": "Hey there! Yeah, great event. Love your Mustang!"
        }
        
        await test_endpoint(
            session, "POST", "/messages", message_data_2,
            "Send reply message from user2 to user1"
        )
        
        # 5. Test GET /api/messages/thread/{user_id}/{partner_id} - Get conversation
        await test_endpoint(
            session, "GET", f"/messages/thread/{actual_user_id_1}/{actual_user_id_2}", None,
            "Get conversation between user1 and user2"
        )
        
        # 6. Test GET /api/messages/conversations/{user_id} - Get all user conversations  
        await test_endpoint(
            session, "GET", f"/messages/conversations/{actual_user_id_1}", None,
            "Get all conversations for user1"
        )
        
        print("\n" + "=" * 60)
        print("🔍 ADDITIONAL ENDPOINT VERIFICATION")
        print("=" * 60)
        
        # Let's check if the other messaging endpoint format exists
        await test_endpoint(
            session, "GET", f"/messages/conversation/{actual_user_id_1}/{actual_user_id_2}", None,
            "Check if alternative conversation endpoint exists"
        )
        
        await test_endpoint(
            session, "GET", f"/messages/user/{actual_user_id_1}", None,
            "Check if user messages endpoint exists"
        )
        
        print("\n" + "=" * 80)
        print("🎯 TEST SUMMARY")
        print("=" * 80)
        print("✅ Tested User Cars endpoints:")
        print("   - POST /api/user-cars")
        print("   - GET /api/user-cars/user/{user_id}")
        print("   - PUT /api/user-cars/{car_id}")
        print("\n✅ Tested Messaging endpoints:")
        print("   - POST /api/messages")
        print("   - GET /api/messages/thread/{user1_id}/{user2_id}")
        print("   - GET /api/messages/conversations/{user_id}")
        print("\n❓ Checked for alternative messaging endpoints:")
        print("   - GET /api/messages/conversation/{user1_id}/{user2_id}")
        print("   - GET /api/messages/user/{user_id}")
        print("=" * 80)

if __name__ == "__main__":
    asyncio.run(main())