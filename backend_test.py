#!/usr/bin/env python3

import requests
import json
import sys
from typing import Dict, Any

# Backend URL from frontend .env
BACKEND_URL = "https://event-hub-okc-1.preview.emergentagent.com/api"

# Test credentials from test_result.md
ADMIN_EMAIL = "admin@okcarevents.com"
ADMIN_PASSWORD = "admin123"
ADMIN_USER_ID = "69bb035fb5d3f5e057f073ca"

def test_admin_login() -> Dict[str, Any]:
    """Test admin login and return auth token/user data"""
    print("🔐 Testing Admin Login...")
    
    url = f"{BACKEND_URL}/auth/login"
    payload = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Admin login successful")
            print(f"User ID: {data.get('id', 'N/A')}")
            print(f"Name: {data.get('name', 'N/A')}")
            print(f"Is Admin: {data.get('isAdmin', 'N/A')}")
            return data
        else:
            print(f"❌ Login failed: {response.text}")
            return {}
            
    except Exception as e:
        print(f"❌ Login error: {str(e)}")
        return {}

def test_public_cars_thumbnails() -> list:
    """Test GET /api/user-cars/public for thumbnail URLs"""
    print("\n🚗 Testing Public Cars with Thumbnails...")
    
    url = f"{BACKEND_URL}/user-cars/public"
    
    try:
        response = requests.get(url, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            cars = response.json()
            print(f"✅ Found {len(cars)} public cars")
            
            # Check for thumbnail URLs in photos array
            cars_with_thumbnails = []
            for car in cars[:3]:  # Check first 3 cars
                car_id = car.get('id')
                photos = car.get('photos', [])
                print(f"\nCar ID: {car_id}")
                print(f"Make/Model: {car.get('make', 'N/A')} {car.get('model', 'N/A')}")
                print(f"Photos count: {len(photos)}")
                
                # Check if photos contain thumbnail URLs (not base64)
                thumbnail_urls = []
                for photo in photos:
                    if isinstance(photo, str):
                        if '/thumbnail.jpg' in photo:
                            thumbnail_urls.append(photo)
                            print(f"✅ Found thumbnail URL: {photo}")
                        elif photo.startswith('data:image/'):
                            print(f"⚠️  Found base64 image (should be URL): {photo[:50]}...")
                        else:
                            print(f"📷 Photo URL: {photo}")
                
                if thumbnail_urls:
                    cars_with_thumbnails.append({
                        'car_id': car_id,
                        'thumbnail_urls': thumbnail_urls
                    })
            
            return cars_with_thumbnails
        else:
            print(f"❌ Failed to get public cars: {response.text}")
            return []
            
    except Exception as e:
        print(f"❌ Error getting public cars: {str(e)}")
        return []

def test_thumbnail_image(car_id: str) -> bool:
    """Test GET /api/user-cars/{car_id}/thumbnail.jpg for valid JPEG"""
    print(f"\n🖼️  Testing Thumbnail Image for Car ID: {car_id}")
    
    # Use the full URL from the backend
    url = f"{BACKEND_URL}/user-cars/{car_id}/thumbnail.jpg"
    
    try:
        response = requests.get(url, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            content_type = response.headers.get('Content-Type', '')
            content_length = len(response.content)
            
            print(f"Content-Type: {content_type}")
            print(f"Content Length: {content_length} bytes ({content_length/1024:.1f} KB)")
            
            # Check if it's a valid JPEG
            if content_type == 'image/jpeg':
                print("✅ Content-Type is image/jpeg")
            else:
                print(f"⚠️  Content-Type is not image/jpeg: {content_type}")
            
            # Check size range (30KB - 300KB)
            if 30000 <= content_length <= 300000:
                print(f"✅ Image size is within expected range (30KB-300KB)")
                return True
            else:
                print(f"⚠️  Image size outside expected range: {content_length/1024:.1f}KB")
                return content_type == 'image/jpeg'
        else:
            print(f"❌ Failed to get thumbnail: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error getting thumbnail: {str(e)}")
        return False

def test_admin_car_data() -> bool:
    """Test GET /api/user-cars/user/{admin_user_id} for admin's car data"""
    print(f"\n👤 Testing Admin's Car Data (User ID: {ADMIN_USER_ID})...")
    
    url = f"{BACKEND_URL}/user-cars/user/{ADMIN_USER_ID}"
    
    try:
        response = requests.get(url, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            car_data = response.json()
            
            if car_data:
                print(f"✅ Admin has car data")
                print(f"Make/Model: {car_data.get('make', 'N/A')} {car_data.get('model', 'N/A')}")
                print(f"Year: {car_data.get('year', 'N/A')}")
                
                photos = car_data.get('photos', [])
                print(f"Photos count: {len(photos)}")
                
                # Check for thumbnail URLs
                thumbnail_found = False
                for photo in photos:
                    if isinstance(photo, str) and '/thumbnail.jpg' in photo:
                        print(f"✅ Found thumbnail URL: {photo}")
                        thumbnail_found = True
                
                return thumbnail_found
            else:
                print("ℹ️  Admin has no car registered")
                return True  # Not an error if admin has no car
        else:
            print(f"❌ Failed to get admin car data: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error getting admin car data: {str(e)}")
        return False

def test_admin_car_with_photos() -> bool:
    """Test GET /api/user-cars/user/{admin_user_id}?include_photos=true"""
    print(f"\n📸 Testing Admin's Car Data with include_photos=true...")
    
    url = f"{BACKEND_URL}/user-cars/user/{ADMIN_USER_ID}?include_photos=true"
    
    try:
        response = requests.get(url, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            car_data = response.json()
            
            if car_data:
                print(f"✅ Admin car data retrieved with include_photos=true")
                print(f"Make/Model: {car_data.get('make', 'N/A')} {car_data.get('model', 'N/A')}")
                
                photos = car_data.get('photos', [])
                print(f"Photos count: {len(photos)}")
                
                # Check if photos are included (should be more detailed with include_photos=true)
                if photos:
                    print("✅ Photos are included in response")
                    for i, photo in enumerate(photos[:3]):  # Show first 3
                        if isinstance(photo, str):
                            if photo.startswith('data:image/'):
                                print(f"Photo {i+1}: Base64 data ({len(photo)} chars)")
                            else:
                                print(f"Photo {i+1}: URL - {photo}")
                    return True
                else:
                    print("ℹ️  No photos in admin's car")
                    return True
            else:
                print("ℹ️  Admin has no car registered")
                return True
        else:
            print(f"❌ Failed to get admin car data with photos: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error getting admin car data with photos: {str(e)}")
        return False

def main():
    """Run all garage/thumbnail tests"""
    print("🚀 Starting Garage/Thumbnail Backend API Tests")
    print("=" * 60)
    
    # Test 1: Admin Login
    admin_data = test_admin_login()
    if not admin_data:
        print("❌ Cannot proceed without admin login")
        sys.exit(1)
    
    # Test 2: Public Cars with Thumbnails
    cars_with_thumbnails = test_public_cars_thumbnails()
    
    # Test 3: Thumbnail Image (if we found cars with thumbnails)
    thumbnail_test_passed = False
    if cars_with_thumbnails:
        # Test first car's thumbnail
        first_car = cars_with_thumbnails[0]
        thumbnail_test_passed = test_thumbnail_image(first_car['car_id'])
    else:
        print("\n⚠️  No cars with thumbnail URLs found to test thumbnail endpoint")
    
    # Test 4: Admin's Car Data
    admin_car_test = test_admin_car_data()
    
    # Test 5: Admin's Car Data with include_photos
    admin_car_photos_test = test_admin_car_with_photos()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    print(f"✅ Admin Login: {'PASS' if admin_data else 'FAIL'}")
    print(f"✅ Public Cars API: {'PASS' if cars_with_thumbnails else 'FAIL - No thumbnail URLs found'}")
    print(f"✅ Thumbnail Image: {'PASS' if thumbnail_test_passed else 'FAIL/SKIP'}")
    print(f"✅ Admin Car Data: {'PASS' if admin_car_test else 'FAIL'}")
    print(f"✅ Admin Car with Photos: {'PASS' if admin_car_photos_test else 'FAIL'}")
    
    # Overall result
    all_critical_passed = (
        admin_data and 
        admin_car_test and 
        admin_car_photos_test
    )
    
    if all_critical_passed:
        print("\n🎉 All critical garage/thumbnail tests PASSED!")
        if not cars_with_thumbnails:
            print("⚠️  Note: No thumbnail URLs found in public cars - may need investigation")
        if not thumbnail_test_passed:
            print("⚠️  Note: Thumbnail image endpoint test failed/skipped")
    else:
        print("\n❌ Some critical tests FAILED - needs attention")
    
    return all_critical_passed

if __name__ == "__main__":
    main()