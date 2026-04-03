#!/usr/bin/env python3
"""
Backend Test Suite for User Feeds Feature
Tests all CRUD operations, likes, comments, and authorization
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend/.env
BACKEND_URL = "https://event-hub-okc-1.preview.emergentagent.com/api"

# Test credentials from review request
ADMIN_EMAIL = "admin@okcarevents.com"
ADMIN_PASSWORD = "admin123"

class UserFeedsTest:
    def __init__(self):
        self.admin_id = None
        self.admin_name = None
        self.test_post_id = None
        self.test_comment_id = None
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })

    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

    def test_login(self):
        """Test 1: POST /api/auth/login - Login to get admin user ID"""
        self.log("🔐 Testing admin login...")
        
        login_data = {
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }
        
        response = self.session.post(f"{BACKEND_URL}/auth/login", json=login_data)
        
        if response.status_code != 200:
            self.log(f"❌ Login failed: {response.status_code} - {response.text}")
            return False
            
        user_data = response.json()
        self.admin_id = user_data.get("id")
        self.admin_name = user_data.get("name", "Admin User")
        
        if not self.admin_id:
            self.log("❌ Login response missing user ID")
            return False
            
        self.log(f"✅ Login successful - Admin ID: {self.admin_id}, Name: {self.admin_name}")
        return True

    def test_create_post(self):
        """Test 2: POST /api/feeds - Create a post"""
        self.log("📝 Testing post creation...")
        
        post_data = {
            "userId": self.admin_id,
            "userName": self.admin_name,
            "text": "First test post about cars! Just got back from an amazing car show in Oklahoma City. The variety of classic muscle cars was incredible!",
            "images": []
        }
        
        response = self.session.post(f"{BACKEND_URL}/feeds", json=post_data)
        
        if response.status_code != 200:
            self.log(f"❌ Post creation failed: {response.status_code} - {response.text}")
            return False
            
        post = response.json()
        self.test_post_id = post.get("id")
        
        if not self.test_post_id:
            self.log("❌ Post creation response missing post ID")
            return False
            
        # Verify post structure
        required_fields = ["id", "userId", "userName", "text", "likes", "commentCount", "createdAt"]
        missing_fields = [field for field in required_fields if field not in post]
        
        if missing_fields:
            self.log(f"❌ Post missing required fields: {missing_fields}")
            return False
            
        self.log(f"✅ Post created successfully - ID: {self.test_post_id}")
        self.log(f"   Text: {post['text'][:50]}...")
        self.log(f"   Likes: {post['likes']}, Comments: {post['commentCount']}")
        return True

    def test_list_posts(self):
        """Test 3: GET /api/feeds - List posts (verify the created post appears)"""
        self.log("📋 Testing post listing...")
        
        response = self.session.get(f"{BACKEND_URL}/feeds")
        
        if response.status_code != 200:
            self.log(f"❌ Post listing failed: {response.status_code} - {response.text}")
            return False
            
        posts = response.json()
        
        if not isinstance(posts, list):
            self.log("❌ Post listing should return an array")
            return False
            
        # Find our test post
        test_post = None
        for post in posts:
            if post.get("id") == self.test_post_id:
                test_post = post
                break
                
        if not test_post:
            self.log(f"❌ Created post {self.test_post_id} not found in listing")
            return False
            
        self.log(f"✅ Post listing successful - Found {len(posts)} posts")
        self.log(f"   Test post found: {test_post['text'][:50]}...")
        return True

    def test_get_single_post(self):
        """Test 4: GET /api/feeds/{post_id} - Get single post by ID"""
        self.log("🔍 Testing single post retrieval...")
        
        response = self.session.get(f"{BACKEND_URL}/feeds/{self.test_post_id}")
        
        if response.status_code != 200:
            self.log(f"❌ Single post retrieval failed: {response.status_code} - {response.text}")
            return False
            
        post = response.json()
        
        if post.get("id") != self.test_post_id:
            self.log(f"❌ Retrieved post ID mismatch: expected {self.test_post_id}, got {post.get('id')}")
            return False
            
        self.log(f"✅ Single post retrieval successful")
        self.log(f"   Post ID: {post['id']}")
        self.log(f"   Text: {post['text'][:50]}...")
        return True

    def test_edit_post(self):
        """Test 5: PUT /api/feeds/{post_id}?user_id={admin_id} - Edit the post text"""
        self.log("✏️ Testing post editing...")
        
        update_data = {
            "text": "Updated test post - This car show was even better than I initially thought! The 1969 Camaro SS was absolutely stunning."
        }
        
        response = self.session.put(
            f"{BACKEND_URL}/feeds/{self.test_post_id}?user_id={self.admin_id}",
            json=update_data
        )
        
        if response.status_code != 200:
            self.log(f"❌ Post editing failed: {response.status_code} - {response.text}")
            return False
            
        updated_post = response.json()
        
        if updated_post.get("text") != update_data["text"]:
            self.log(f"❌ Post text not updated correctly")
            return False
            
        if not updated_post.get("edited"):
            self.log(f"❌ Post should be marked as edited")
            return False
            
        self.log(f"✅ Post editing successful")
        self.log(f"   Updated text: {updated_post['text'][:50]}...")
        self.log(f"   Edited flag: {updated_post['edited']}")
        return True

    def test_like_post_first_time(self):
        """Test 6: POST /api/feeds/{post_id}/like?user_id={admin_id} - Like the post (should return liked=true)"""
        self.log("👍 Testing post like (first time)...")
        
        response = self.session.post(f"{BACKEND_URL}/feeds/{self.test_post_id}/like?user_id={self.admin_id}")
        
        if response.status_code != 200:
            self.log(f"❌ Post like failed: {response.status_code} - {response.text}")
            return False
            
        like_result = response.json()
        
        if not like_result.get("liked"):
            self.log(f"❌ Post should be liked after first like")
            return False
            
        if like_result.get("likes") != 1:
            self.log(f"❌ Like count should be 1, got {like_result.get('likes')}")
            return False
            
        self.log(f"✅ Post like successful")
        self.log(f"   Liked: {like_result['liked']}, Count: {like_result['likes']}")
        return True

    def test_like_post_toggle(self):
        """Test 7: POST /api/feeds/{post_id}/like?user_id={admin_id} - Like again (toggle - should return liked=false)"""
        self.log("👎 Testing post like toggle (unlike)...")
        
        response = self.session.post(f"{BACKEND_URL}/feeds/{self.test_post_id}/like?user_id={self.admin_id}")
        
        if response.status_code != 200:
            self.log(f"❌ Post unlike failed: {response.status_code} - {response.text}")
            return False
            
        like_result = response.json()
        
        if like_result.get("liked"):
            self.log(f"❌ Post should be unliked after toggle")
            return False
            
        if like_result.get("likes") != 0:
            self.log(f"❌ Like count should be 0, got {like_result.get('likes')}")
            return False
            
        self.log(f"✅ Post unlike successful")
        self.log(f"   Liked: {like_result['liked']}, Count: {like_result['likes']}")
        return True

    def test_add_comment(self):
        """Test 8: POST /api/feeds/{post_id}/comments - Add comment"""
        self.log("💬 Testing comment addition...")
        
        comment_data = {
            "userId": self.admin_id,
            "userName": self.admin_name,
            "text": "Great post! I was at that show too. The Camaro was definitely the highlight of the event."
        }
        
        response = self.session.post(f"{BACKEND_URL}/feeds/{self.test_post_id}/comments", json=comment_data)
        
        if response.status_code != 200:
            self.log(f"❌ Comment addition failed: {response.status_code} - {response.text}")
            return False
            
        comment = response.json()
        self.test_comment_id = comment.get("id")
        
        if not self.test_comment_id:
            self.log("❌ Comment creation response missing comment ID")
            return False
            
        # Verify comment structure
        required_fields = ["id", "postId", "userId", "userName", "text", "createdAt"]
        missing_fields = [field for field in required_fields if field not in comment]
        
        if missing_fields:
            self.log(f"❌ Comment missing required fields: {missing_fields}")
            return False
            
        self.log(f"✅ Comment added successfully - ID: {self.test_comment_id}")
        self.log(f"   Text: {comment['text'][:50]}...")
        return True

    def test_list_comments(self):
        """Test 9: GET /api/feeds/{post_id}/comments - List comments (verify comment appears)"""
        self.log("📝 Testing comment listing...")
        
        response = self.session.get(f"{BACKEND_URL}/feeds/{self.test_post_id}/comments")
        
        if response.status_code != 200:
            self.log(f"❌ Comment listing failed: {response.status_code} - {response.text}")
            return False
            
        comments = response.json()
        
        if not isinstance(comments, list):
            self.log("❌ Comment listing should return an array")
            return False
            
        # Find our test comment
        test_comment = None
        for comment in comments:
            if comment.get("id") == self.test_comment_id:
                test_comment = comment
                break
                
        if not test_comment:
            self.log(f"❌ Created comment {self.test_comment_id} not found in listing")
            return False
            
        self.log(f"✅ Comment listing successful - Found {len(comments)} comments")
        self.log(f"   Test comment found: {test_comment['text'][:50]}...")
        return True

    def test_delete_comment(self):
        """Test 10: DELETE /api/feeds/{post_id}/comments/{comment_id}?user_id={admin_id} - Delete the comment"""
        self.log("🗑️ Testing comment deletion...")
        
        response = self.session.delete(
            f"{BACKEND_URL}/feeds/{self.test_post_id}/comments/{self.test_comment_id}?user_id={self.admin_id}"
        )
        
        if response.status_code != 200:
            self.log(f"❌ Comment deletion failed: {response.status_code} - {response.text}")
            return False
            
        result = response.json()
        
        if result.get("status") != "deleted":
            self.log(f"❌ Comment deletion should return status 'deleted'")
            return False
            
        # Verify comment is gone
        response = self.session.get(f"{BACKEND_URL}/feeds/{self.test_post_id}/comments")
        if response.status_code == 200:
            comments = response.json()
            for comment in comments:
                if comment.get("id") == self.test_comment_id:
                    self.log(f"❌ Comment still exists after deletion")
                    return False
                    
        self.log(f"✅ Comment deletion successful")
        return True

    def test_authorization_edit_other_user_post(self):
        """Test 11: Test authorization - Try PUT /api/feeds/{post_id}?user_id=fake_user_id - Should return 403"""
        self.log("🔒 Testing authorization (edit other user's post)...")
        
        fake_user_id = "507f1f77bcf86cd799439011"  # Valid ObjectId format but fake
        update_data = {
            "text": "Trying to edit someone else's post"
        }
        
        response = self.session.put(
            f"{BACKEND_URL}/feeds/{self.test_post_id}?user_id={fake_user_id}",
            json=update_data
        )
        
        if response.status_code != 403:
            self.log(f"❌ Authorization test failed: expected 403, got {response.status_code}")
            return False
            
        self.log(f"✅ Authorization test successful - 403 Forbidden returned")
        return True

    def test_delete_post(self):
        """Test 12: DELETE /api/feeds/{post_id}?user_id={admin_id} - Delete the post"""
        self.log("🗑️ Testing post deletion...")
        
        response = self.session.delete(f"{BACKEND_URL}/feeds/{self.test_post_id}?user_id={self.admin_id}")
        
        if response.status_code != 200:
            self.log(f"❌ Post deletion failed: {response.status_code} - {response.text}")
            return False
            
        result = response.json()
        
        if result.get("status") != "deleted":
            self.log(f"❌ Post deletion should return status 'deleted'")
            return False
            
        self.log(f"✅ Post deletion successful")
        return True

    def test_verify_post_deleted(self):
        """Test 13: GET /api/feeds - Verify deleted post is gone"""
        self.log("🔍 Testing post deletion verification...")
        
        response = self.session.get(f"{BACKEND_URL}/feeds")
        
        if response.status_code != 200:
            self.log(f"❌ Post listing failed: {response.status_code} - {response.text}")
            return False
            
        posts = response.json()
        
        # Check that our test post is no longer in the list
        for post in posts:
            if post.get("id") == self.test_post_id:
                self.log(f"❌ Deleted post still appears in listing")
                return False
                
        self.log(f"✅ Post deletion verified - Post no longer in listing")
        return True

    def run_all_tests(self):
        """Run all User Feeds tests in sequence"""
        self.log("🚀 Starting User Feeds Backend API Tests")
        self.log(f"Backend URL: {BACKEND_URL}")
        
        tests = [
            ("Login", self.test_login),
            ("Create Post", self.test_create_post),
            ("List Posts", self.test_list_posts),
            ("Get Single Post", self.test_get_single_post),
            ("Edit Post", self.test_edit_post),
            ("Like Post (First)", self.test_like_post_first_time),
            ("Like Post (Toggle)", self.test_like_post_toggle),
            ("Add Comment", self.test_add_comment),
            ("List Comments", self.test_list_comments),
            ("Delete Comment", self.test_delete_comment),
            ("Authorization Test", self.test_authorization_edit_other_user_post),
            ("Delete Post", self.test_delete_post),
            ("Verify Deletion", self.test_verify_post_deleted),
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            try:
                if test_func():
                    passed += 1
                else:
                    failed += 1
                    self.log(f"❌ {test_name} FAILED")
            except Exception as e:
                failed += 1
                self.log(f"❌ {test_name} FAILED with exception: {e}")
            
            self.log("")  # Empty line for readability
        
        self.log("=" * 60)
        self.log(f"🏁 User Feeds Backend API Test Results:")
        self.log(f"   ✅ Passed: {passed}")
        self.log(f"   ❌ Failed: {failed}")
        self.log(f"   📊 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        
        if failed == 0:
            self.log("🎉 ALL TESTS PASSED! User Feeds API is working correctly.")
            return True
        else:
            self.log("⚠️  Some tests failed. Please check the logs above.")
            return False

if __name__ == "__main__":
    tester = UserFeedsTest()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)