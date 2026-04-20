#!/usr/bin/env python3
"""
Focused Multi-Car Garage Test - Testing the specific workflow from review request
"""

import requests
import json

BACKEND_URL = "https://github-check-4.preview.emergentagent.com"
ADMIN_EMAIL = "admin@okcarevents.com"
ADMIN_PASSWORD = "admin123"
ADMIN_USER_ID = "69bb035fb5d3f5e057f073ca"

def test_workflow():
    print("🚗 MULTI-CAR GARAGE WORKFLOW TEST")
    print("=" * 50)
    
    # Step 1: Login as admin
    print("\n1. Admin Login...")
    response = requests.post(f"{BACKEND_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    
    if response.status_code == 200:
        admin_data = response.json()
        print(f"✅ Admin login successful. isAdmin: {admin_data.get('isAdmin')}")
    else:
        print(f"❌ Admin login failed: {response.text}")
        return
    
    # Step 2: GET /api/user-cars/user/{user_id}/all - verify returns array with car(s)
    print("\n2. Get all user cars...")
    response = requests.get(f"{BACKEND_URL}/api/user-cars/user/{ADMIN_USER_ID}/all")
    
    if response.status_code == 200:
        cars = response.json()
        print(f"✅ Retrieved {len(cars)} cars")
        for i, car in enumerate(cars):
            print(f"   Car {i+1}: {car.get('year')} {car.get('make')} {car.get('model')}")
            print(f"           thumbnailUrl: {'✅' if car.get('thumbnailUrl') else '❌'}")
            print(f"           isActive: {car.get('isActive')}")
        
        original_car_id = cars[0].get('id') if cars else None
    else:
        print(f"❌ Failed to get cars: {response.text}")
        return
    
    # Step 3: POST /api/user-cars/create-or-update-metadata - create 2nd car
    print("\n3. Create second car (Toyota Supra)...")
    car_data = {
        "userId": ADMIN_USER_ID,
        "make": "Toyota",
        "model": "Supra",
        "year": "2023",
        "color": "White",
        "isPublic": True,
        "description": "Test car"
    }
    
    response = requests.post(f"{BACKEND_URL}/api/user-cars/create-or-update-metadata", json=car_data)
    
    if response.status_code == 200:
        new_car = response.json()
        new_car_id = new_car.get('id')
        print(f"✅ Created second car. ID: {new_car_id}, isActive: {new_car.get('isActive')}")
    else:
        print(f"❌ Failed to create second car: {response.text}")
        return
    
    # Step 4: GET /api/user-cars/user/{user_id}/all - should now return 2 cars
    print("\n4. Verify two cars...")
    response = requests.get(f"{BACKEND_URL}/api/user-cars/user/{ADMIN_USER_ID}/all")
    
    if response.status_code == 200:
        cars = response.json()
        print(f"✅ Now have {len(cars)} cars")
        active_count = sum(1 for car in cars if car.get('isActive'))
        print(f"   Active cars: {active_count}")
    else:
        print(f"❌ Failed to verify cars: {response.text}")
        return
    
    # Step 5: PUT /api/user-cars/{new_car_id}/set-active - toggle new car as active
    print("\n5. Set Toyota Supra as active...")
    response = requests.put(f"{BACKEND_URL}/api/user-cars/{new_car_id}/set-active")
    
    if response.status_code == 200:
        print(f"✅ Set new car as active: {response.json().get('message')}")
    else:
        print(f"❌ Failed to set active: {response.text}")
        return
    
    # Step 6: Verify first car is now inactive
    print("\n6. Verify active car switch...")
    response = requests.get(f"{BACKEND_URL}/api/user-cars/user/{ADMIN_USER_ID}/all")
    
    if response.status_code == 200:
        cars = response.json()
        active_cars = [car for car in cars if car.get('isActive')]
        if len(active_cars) == 1 and active_cars[0].get('make') == 'Toyota':
            print("✅ Toyota Supra is now the active car")
        else:
            print(f"❌ Wrong active car: {active_cars}")
    else:
        print(f"❌ Failed to verify switch: {response.text}")
        return
    
    # Step 7: Try POST /api/user-cars/create-or-update-metadata with 3rd car - should get 400 error
    print("\n7. Test car limit (attempt 3rd car)...")
    third_car_data = {
        "userId": ADMIN_USER_ID,
        "make": "Ford",
        "model": "Mustang",
        "year": "2024",
        "color": "Red",
        "isPublic": True,
        "description": "Third test car - should fail"
    }
    
    response = requests.post(f"{BACKEND_URL}/api/user-cars/create-or-update-metadata", json=third_car_data)
    
    if response.status_code == 400:
        error_msg = response.json().get('detail', '')
        if "Maximum of 2 cars" in error_msg:
            print(f"✅ Correctly rejected 3rd car: {error_msg}")
        else:
            print(f"❌ Wrong error message: {error_msg}")
    else:
        print(f"❌ Expected 400 error, got {response.status_code}: {response.text}")
        # If it succeeded, we need to delete it
        if response.status_code == 200:
            third_car_id = response.json().get('id')
            requests.delete(f"{BACKEND_URL}/api/user-cars/{third_car_id}?user_id={ADMIN_USER_ID}")
            print("   (Cleaned up unexpected third car)")
    
    # Step 8: Clean up - DELETE /api/user-cars/{new_car_id}
    print("\n8. Clean up test car...")
    response = requests.delete(f"{BACKEND_URL}/api/user-cars/{new_car_id}?user_id={ADMIN_USER_ID}")
    
    if response.status_code == 200:
        print(f"✅ Deleted test car: {response.json().get('message')}")
    else:
        print(f"❌ Failed to delete test car: {response.text}")
    
    # Step 9: Restore original car as active
    print("\n9. Restore original car as active...")
    restore_car_id = original_car_id or "69cb30e24ddc647117911a44"
    response = requests.put(f"{BACKEND_URL}/api/user-cars/{restore_car_id}/set-active")
    
    if response.status_code == 200:
        print(f"✅ Restored original car as active: {response.json().get('message')}")
    else:
        print(f"❌ Failed to restore original car: {response.text}")
    
    print("\n" + "=" * 50)
    print("🏁 MULTI-CAR GARAGE WORKFLOW COMPLETE")

if __name__ == "__main__":
    test_workflow()