#!/usr/bin/env python3

import asyncio
import aiohttp
import json
from datetime import datetime
import uuid

# Backend URL from frontend env
BASE_URL = "https://drive-okc.preview.emergentagent.com/api"

# Test data with enhanced fields
TEST_USER_ID = str(uuid.uuid4())
TEST_USER_ID_2 = str(uuid.uuid4())
ENHANCED_CAR_DATA = {
    "userId": TEST_USER_ID,
    "make": "Toyota",
    "model": "Supra",
    "year": "2024",
    "color": "Nitro Yellow",
    "trim": "3.0 Premium",
    "engine": "3.0L Twin-Turbo I6",
    "horsepower": 382,
    "torque": 368,
    "transmission": "8-speed automatic",
    "drivetrain": "RWD",
    "description": "My track-ready beast",
    "photos": ["data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAAA==", "data:image/jpeg;base64,/9j/4BBBSkZJRgABAQEAAA=="],
    "videos": ["https://youtube.com/watch?v=abc123", "https://instagram.com/p/def456"],
    "modifications": [
        {
            "category": "Engine", 
            "name": "Cold Air Intake",
            "brand": "K&N",
            "description": "High-flow air intake system",
            "cost": 299.99
        },
        {
            "category": "Exhaust",
            "name": "Catback Exhaust",
            "brand": "Borla",
            "description": "ATAK catback exhaust system",
            "cost": 1299.99
        }
    ],
    "modificationNotes": "Tuned for 91 octane. Next mods: downpipe and tune.",
    "isPublic": True,
    "instagramHandle": "@supra_beast_2024",
    "youtubeChannel": "SupraBeast2024"
}

PRIVATE_CAR_DATA = {
    "userId": TEST_USER_ID_2,
    "make": "BMW",
    "model": "M3",
    "year": "2023",
    "color": "Alpine White",
    "trim": "Competition",
    "engine": "3.0L Twin-Turbo I6",
    "horsepower": 503,
    "torque": 479,
    "transmission": "8-speed automatic",
    "drivetrain": "RWD",
    "description": "Daily driver with some track time",
    "photos": ["data:image/jpeg;base64,/9j/4CCCSkZJRgABAQEAAA=="],
    "videos": [],
    "modifications": [
        {
            "category": "Performance",
            "name": "Stage 1 Tune", 
            "brand": "Bootmod3",
            "description": "ECU tune for more power",
            "cost": 599.99
        }
    ],
    "modificationNotes": "Conservative tune for daily reliability.",
    "isPublic": False,  # This should NOT appear in public garages
    "instagramHandle": "@bmw_m3_daily",
    "youtubeChannel": ""
}

async def test_endpoint(session, method, endpoint, data=None, params=None, description=""):
    """Test an API endpoint and return the result"""
    url = f"{BASE_URL}{endpoint}"
    
    print(f"\n🔍 Testing {method} {endpoint}")
    print(f"📝 {description}")
    print(f"🌐 URL: {url}")
    
    if params:
        print(f"📊 Query params: {params}")
    if data:
        print(f"📤 Request data: {json.dumps(data, indent=2)}")
    
    try:
        async with session.request(method, url, json=data, params=params) as response:
            print(f"📊 Status: {response.status}")
            
            try:
                response_data = await response.json()
                if isinstance(response_data, list) and len(response_data) > 2:
                    print(f"📥 Response: [List with {len(response_data)} items - showing first 2]")
                    print(json.dumps(response_data[:2], indent=2))
                else:
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
    print("🚗 ENHANCED MY GARAGE (USER CARS) SYSTEM TEST")
    print("=" * 80)
    
    async with aiohttp.ClientSession() as session:
        
        # Create test users first
        print("\n" + "=" * 60)
        print("👤 CREATING TEST USERS")
        print("=" * 60)
        
        user1_data = {
            "email": f"testuser1_{TEST_USER_ID[:8]}@example.com",
            "name": "Alex Rodriguez",
            "password": "testpass123",
            "nickname": "AlexR"
        }
        
        user2_data = {
            "email": f"testuser2_{TEST_USER_ID_2[:8]}@example.com", 
            "name": "Sarah Johnson",
            "password": "testpass456",
            "nickname": "SarahJ"
        }
        
        user1_status, user1_response = await test_endpoint(
            session, "POST", "/auth/register", user1_data, None,
            "Register test user 1 (Supra owner)"
        )
        
        user2_status, user2_response = await test_endpoint(
            session, "POST", "/auth/register", user2_data, None,
            "Register test user 2 (BMW M3 owner)"
        )
        
        # Extract actual user IDs
        if user1_status == 200 and isinstance(user1_response, dict):
            actual_user_id_1 = user1_response.get('id', TEST_USER_ID)
            ENHANCED_CAR_DATA["userId"] = actual_user_id_1
        else:
            actual_user_id_1 = TEST_USER_ID
            
        if user2_status == 200 and isinstance(user2_response, dict):
            actual_user_id_2 = user2_response.get('id', TEST_USER_ID_2)
            PRIVATE_CAR_DATA["userId"] = actual_user_id_2
        else:
            actual_user_id_2 = TEST_USER_ID_2
        
        print(f"\n✅ Test User IDs: {actual_user_id_1}, {actual_user_id_2}")
        
        # ============================================================================
        # TEST 1: CREATE PUBLIC CAR WITH ALL NEW ENHANCED FIELDS
        # ============================================================================
        print("\n" + "=" * 60)
        print("🚗 TEST 1: CREATE PUBLIC CAR WITH ENHANCED FIELDS")
        print("=" * 60)
        
        public_car_status, public_car_response = await test_endpoint(
            session, "POST", "/user-cars", ENHANCED_CAR_DATA, None,
            "Create public Toyota Supra with horsepower, torque, modifications, videos, Instagram, etc."
        )
        
        public_car_id = None
        if public_car_status == 200 and isinstance(public_car_response, dict):
            public_car_id = public_car_response.get('id')
            print(f"✅ Public car created successfully with ID: {public_car_id}")
            # Verify all new fields are present
            expected_fields = ['horsepower', 'torque', 'transmission', 'drivetrain', 'videos', 'modifications', 'modificationNotes', 'isPublic', 'instagramHandle', 'youtubeChannel', 'likes', 'views']
            missing_fields = [field for field in expected_fields if field not in public_car_response]
            if missing_fields:
                print(f"⚠️  Missing fields in response: {missing_fields}")
            else:
                print("✅ All enhanced fields present in response")
        else:
            print(f"❌ Failed to create public car: {public_car_response}")
        
        # ============================================================================
        # TEST 2: CREATE PRIVATE CAR
        # ============================================================================
        print("\n" + "=" * 60)
        print("🔒 TEST 2: CREATE PRIVATE CAR")
        print("=" * 60)
        
        private_car_status, private_car_response = await test_endpoint(
            session, "POST", "/user-cars", PRIVATE_CAR_DATA, None,
            "Create private BMW M3 (isPublic: false)"
        )
        
        private_car_id = None
        if private_car_status == 200 and isinstance(private_car_response, dict):
            private_car_id = private_car_response.get('id')
            print(f"✅ Private car created successfully with ID: {private_car_id}")
            if private_car_response.get('isPublic') == False:
                print("✅ Car correctly marked as private (isPublic: false)")
            else:
                print(f"❌ Car isPublic field incorrect: {private_car_response.get('isPublic')}")
        else:
            print(f"❌ Failed to create private car: {private_car_response}")
        
        # ============================================================================
        # TEST 3: GET PUBLIC GARAGES
        # ============================================================================
        print("\n" + "=" * 60)
        print("🌐 TEST 3: GET PUBLIC GARAGES")
        print("=" * 60)
        
        public_garages_status, public_garages_response = await test_endpoint(
            session, "GET", "/user-cars/public", None, None,
            "Get all public garages - should include Supra but NOT BMW M3"
        )
        
        if public_garages_status == 200 and isinstance(public_garages_response, list):
            public_car_found = False
            private_car_found = False
            
            for car in public_garages_response:
                if car.get('id') == public_car_id:
                    public_car_found = True
                    print(f"✅ Public Supra found in public garages")
                    # Check owner info
                    if 'ownerName' in car and 'ownerNickname' in car:
                        print(f"✅ Owner info present: {car['ownerName']} ({car['ownerNickname']})")
                    else:
                        print("❌ Missing owner info (ownerName/ownerNickname)")
                        
                if car.get('id') == private_car_id:
                    private_car_found = True
                    
            if public_car_found:
                print("✅ Public car correctly appears in public garages")
            else:
                print("❌ Public car missing from public garages")
                
            if not private_car_found:
                print("✅ Private car correctly excluded from public garages")
            else:
                print("❌ Private car incorrectly appears in public garages")
        else:
            print(f"❌ Failed to get public garages: {public_garages_response}")
        
        # ============================================================================
        # TEST 4: UPDATE CAR TO PRIVATE
        # ============================================================================
        print("\n" + "=" * 60)
        print("🔄 TEST 4: UPDATE CAR VISIBILITY TO PRIVATE")
        print("=" * 60)
        
        if public_car_id:
            update_data = {
                "isPublic": False,
                "horsepower": 400,  # Also test updating performance specs
                "modificationNotes": "Added turbo upgrade. Now making 400hp!"
            }
            
            update_status, update_response = await test_endpoint(
                session, "PUT", f"/user-cars/{public_car_id}", update_data, None,
                "Update Supra to private and increase horsepower"
            )
            
            if update_status == 200:
                print("✅ Car updated successfully")
                if update_response.get('isPublic') == False:
                    print("✅ Car correctly updated to private")
                if update_response.get('horsepower') == 400:
                    print("✅ Horsepower correctly updated to 400")
            else:
                print(f"❌ Failed to update car: {update_response}")
        else:
            print("❌ Skipping update test - no public car ID")
        
        # ============================================================================
        # TEST 5: VERIFY CAR NO LONGER IN PUBLIC GARAGES
        # ============================================================================
        print("\n" + "=" * 60)
        print("🔍 TEST 5: VERIFY UPDATED CAR NOT IN PUBLIC GARAGES")
        print("=" * 60)
        
        public_garages_after_update_status, public_garages_after_response = await test_endpoint(
            session, "GET", "/user-cars/public", None, None,
            "Verify Supra no longer appears in public garages"
        )
        
        if public_garages_after_update_status == 200:
            car_found_after_update = any(car.get('id') == public_car_id for car in public_garages_after_response)
            if not car_found_after_update:
                print("✅ Updated car correctly removed from public garages")
            else:
                print("❌ Updated car still appears in public garages")
        else:
            print(f"❌ Failed to get public garages after update")
        
        # ============================================================================
        # TEST 6: TEST LIKE FUNCTIONALITY
        # ============================================================================
        print("\n" + "=" * 60)
        print("❤️  TEST 6: TEST LIKE FUNCTIONALITY")
        print("=" * 60)
        
        # First make the private BMW public so we can like it
        if private_car_id:
            make_public_data = {"isPublic": True}
            await test_endpoint(
                session, "PUT", f"/user-cars/{private_car_id}", make_public_data, None,
                "Make BMW M3 public for like testing"
            )
        
        if private_car_id:
            like_status, like_response = await test_endpoint(
                session, "POST", f"/user-cars/{private_car_id}/like", None, {"user_id": actual_user_id_1},
                "User 1 likes User 2's BMW M3"
            )
            
            if like_status == 200 and isinstance(like_response, dict):
                if like_response.get('likes', 0) > 0:
                    print(f"✅ Like successful, likes count: {like_response.get('likes')}")
                else:
                    print("❌ Like failed - likes count not incremented")
            else:
                print(f"❌ Like request failed: {like_response}")
                
            # Test another like from same user (should still increment - no duplicate prevention implemented)
            like_status_2, like_response_2 = await test_endpoint(
                session, "POST", f"/user-cars/{private_car_id}/like", None, {"user_id": actual_user_id_1},
                "Same user likes the car again"
            )
            
            if like_status_2 == 200:
                print(f"✅ Second like processed, likes count: {like_response_2.get('likes', 0)}")
        else:
            print("❌ Skipping like test - no private car ID")
        
        # ============================================================================
        # TEST 7: GET CAR BY ID AND TEST VIEW INCREMENT  
        # ============================================================================
        print("\n" + "=" * 60)
        print("👀 TEST 7: GET CAR BY ID AND TEST VIEW INCREMENT")
        print("=" * 60)
        
        if private_car_id:
            # Get initial view count
            view1_status, view1_response = await test_endpoint(
                session, "GET", f"/user-cars/{private_car_id}", None, None,
                "Get BMW M3 by ID (should increment views)"
            )
            
            initial_views = view1_response.get('views', 0) if view1_status == 200 else 0
            
            # Get it again to test view increment
            view2_status, view2_response = await test_endpoint(
                session, "GET", f"/user-cars/{private_car_id}", None, None,
                "Get BMW M3 by ID again (should increment views)"
            )
            
            second_views = view2_response.get('views', 0) if view2_status == 200 else 0
            
            if second_views > initial_views:
                print(f"✅ Views correctly incremented: {initial_views} -> {second_views}")
            else:
                print(f"❌ Views not incremented: {initial_views} -> {second_views}")
                
            # Verify owner info is included
            if view2_status == 200:
                if 'ownerName' in view2_response and 'ownerNickname' in view2_response:
                    print(f"✅ Owner info included: {view2_response['ownerName']} ({view2_response['ownerNickname']})")
                else:
                    print("❌ Owner info missing from individual car response")
        else:
            print("❌ Skipping view test - no private car ID")
        
        # ============================================================================
        # TEST 8: TEST MAKE FILTER ON PUBLIC GARAGES
        # ============================================================================
        print("\n" + "=" * 60)
        print("🔍 TEST 8: TEST MAKE FILTER ON PUBLIC GARAGES")
        print("=" * 60)
        
        bmw_filter_status, bmw_filter_response = await test_endpoint(
            session, "GET", "/user-cars/public", None, {"make": "BMW"},
            "Filter public garages by BMW make"
        )
        
        if bmw_filter_status == 200 and isinstance(bmw_filter_response, list):
            bmw_cars = [car for car in bmw_filter_response if car.get('make', '').lower() == 'bmw']
            if len(bmw_cars) > 0:
                print(f"✅ BMW filter working: found {len(bmw_cars)} BMW(s)")
            else:
                print("❌ BMW filter not working or no BMWs in public garages")
        else:
            print(f"❌ BMW filter test failed: {bmw_filter_response}")
            
        # Test with Toyota filter
        toyota_filter_status, toyota_filter_response = await test_endpoint(
            session, "GET", "/user-cars/public", None, {"make": "Toyota"},
            "Filter public garages by Toyota make"
        )
        
        if toyota_filter_status == 200:
            toyota_cars = [car for car in toyota_filter_response if car.get('make', '').lower() == 'toyota']
            if len(toyota_cars) == 0:  # Supra should be private now
                print("✅ Toyota filter correct: no public Toyotas found (Supra is private)")
            else:
                print(f"⚠️  Found {len(toyota_cars)} Toyota(s) in public garages")
        
        # ============================================================================
        # TEST SUMMARY
        # ============================================================================
        print("\n" + "=" * 80)
        print("🎯 ENHANCED MY GARAGE SYSTEM TEST SUMMARY")
        print("=" * 80)
        print("✅ Tested Enhanced Endpoints:")
        print("   - POST /api/user-cars (with all new fields)")
        print("   - PUT /api/user-cars/{car_id} (with new fields)")
        print("   - GET /api/user-cars/public (with owner info)")
        print("   - POST /api/user-cars/{car_id}/like")
        print("   - GET /api/user-cars/{car_id} (with view increment)")
        print("\n✅ Tested Enhanced Features:")
        print("   - Performance fields (horsepower, torque, transmission, drivetrain)")
        print("   - Media fields (photos, videos)")
        print("   - Modification tracking (structured modifications + notes)")
        print("   - Social media integration (Instagram, YouTube)")
        print("   - Privacy controls (isPublic flag)")
        print("   - Community features (likes, views)")
        print("   - Make filtering on public garages")
        print("   - Owner information in responses")
        print("=" * 80)

if __name__ == "__main__":
    asyncio.run(main())