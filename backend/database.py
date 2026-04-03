from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection with pool size limits for containerized environments
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(
    mongo_url,
    maxPoolSize=10,
    minPoolSize=1,
    maxIdleTimeMS=30000,
    serverSelectionTimeoutMS=5000,
)
db = client[os.environ['DB_NAME']]
