#!/usr/bin/env python3
"""
Verify Apple user was created with correct authProvider in database
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

async def verify_apple_user():
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'test_database')
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Find the Apple user we created
    apple_user = await db.users.find_one({"email": "apple_complete_test@example.com"})
    
    if apple_user:
        print(f"✅ Found Apple user in database:")
        print(f"   Email: {apple_user.get('email')}")
        print(f"   Name: {apple_user.get('name')}")
        print(f"   Nickname: {apple_user.get('nickname')}")
        print(f"   Auth Provider: {apple_user.get('authProvider')}")
        print(f"   Apple ID: {apple_user.get('appleId')}")
        
        if apple_user.get('authProvider') == 'apple':
            print("✅ User correctly has authProvider: 'apple'")
        else:
            print(f"❌ User has incorrect authProvider: {apple_user.get('authProvider')}")
    else:
        print("❌ Apple user not found in database")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(verify_apple_user())