import math
import re
import os
import io
import base64
import logging
import httpx
from PIL import Image

# Register HEIC/HEIF support (Apple photos)
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    pass

# Increase PIL's decompression bomb limit for large photos
Image.MAX_IMAGE_PIXELS = 500_000_000

logger = logging.getLogger(__name__)

# ==================== Photo Compression ====================

MAX_PHOTO_DIMENSION = 1200  # Max width or height in pixels
MAX_PHOTO_SIZE_BYTES = 800_000  # ~800KB per photo after compression
JPEG_QUALITY = 75

# Thumbnail settings for browse/list views
THUMBNAIL_DIMENSION = 800  # Max width/height for thumbnails (good for full-width cards)
THUMBNAIL_MAX_BYTES = 300_000  # ~300KB per thumbnail (high quality for car showcase)
THUMBNAIL_QUALITY = 82


def make_thumbnail_base64(photo_b64: str) -> str:
    """Create a small thumbnail from a base64 photo for list/browse views."""
    try:
        if not photo_b64 or len(photo_b64) < 100:
            return photo_b64

        # Strip data URI prefix if present
        if ',' in photo_b64 and photo_b64.startswith('data:'):
            _hdr, raw_b64 = photo_b64.split(',', 1)
        else:
            raw_b64 = photo_b64

        img_bytes = base64.b64decode(raw_b64)

        # If already small enough for a thumbnail, return as-is
        if len(img_bytes) <= THUMBNAIL_MAX_BYTES:
            return photo_b64

        img = Image.open(io.BytesIO(img_bytes))

        # Convert RGBA to RGB for JPEG
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')

        # Resize to thumbnail dimensions
        w, h = img.size
        if w > THUMBNAIL_DIMENSION or h > THUMBNAIL_DIMENSION:
            ratio = min(THUMBNAIL_DIMENSION / w, THUMBNAIL_DIMENSION / h)
            new_size = (int(w * ratio), int(h * ratio))
            img = img.resize(new_size, Image.LANCZOS)

        # Compress aggressively
        buffer = io.BytesIO()
        quality = THUMBNAIL_QUALITY
        img.save(buffer, format='JPEG', quality=quality, optimize=True)

        # Further reduce if still too large
        while buffer.tell() > THUMBNAIL_MAX_BYTES and quality > 20:
            buffer = io.BytesIO()
            quality -= 10
            img.save(buffer, format='JPEG', quality=quality, optimize=True)

        compressed_b64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        return f"data:image/jpeg;base64,{compressed_b64}"

    except Exception as e:
        logger.warning(f"Thumbnail creation failed: {e}")
        return ""

def compress_photo_base64(photo_b64: str) -> str:
    """Compress a base64-encoded photo to reduce MongoDB document size.
    Returns compressed base64 string."""
    try:
        # Strip data URI prefix if present
        if ',' in photo_b64 and photo_b64.startswith('data:'):
            header, raw_b64 = photo_b64.split(',', 1)
        else:
            header = None
            raw_b64 = photo_b64

        img_bytes = base64.b64decode(raw_b64)

        # If already small enough, return as-is
        if len(img_bytes) <= MAX_PHOTO_SIZE_BYTES:
            return photo_b64

        img = Image.open(io.BytesIO(img_bytes))

        # Convert RGBA to RGB for JPEG
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')

        # Resize if too large
        w, h = img.size
        if w > MAX_PHOTO_DIMENSION or h > MAX_PHOTO_DIMENSION:
            ratio = min(MAX_PHOTO_DIMENSION / w, MAX_PHOTO_DIMENSION / h)
            new_size = (int(w * ratio), int(h * ratio))
            img = img.resize(new_size, Image.LANCZOS)

        # Compress to JPEG
        buffer = io.BytesIO()
        quality = JPEG_QUALITY
        img.save(buffer, format='JPEG', quality=quality, optimize=True)

        # If still too large, reduce quality further
        while buffer.tell() > MAX_PHOTO_SIZE_BYTES and quality > 30:
            buffer = io.BytesIO()
            quality -= 10
            img.save(buffer, format='JPEG', quality=quality, optimize=True)

        compressed_b64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

        if header:
            return f"data:image/jpeg;base64,{compressed_b64}"
        return compressed_b64

    except Exception as e:
        logger.warning(f"Photo compression failed, using original: {e}")
        return photo_b64


def compress_photos_list(photos: list) -> list:
    """Compress a list of base64 photos."""
    if not photos:
        return photos
    return [compress_photo_base64(p) for p in photos if p]


# ==================== Serializer Helpers ====================

def _sid(val):
    """Safely convert a value to string if it's an ObjectId, else return as-is."""
    from bson import ObjectId
    if isinstance(val, ObjectId):
        return str(val)
    return val


def _isodate(val):
    """Convert a datetime to ISO format string, or return string as-is."""
    from datetime import datetime as dt
    if val is None:
        return None
    if isinstance(val, dt):
        return val.isoformat()
    return str(val)


def event_helper(event) -> dict:
    return {
        "id": str(event["_id"]),
        "title": event["title"],
        "description": event["description"],
        "date": _isodate(event.get("date")),
        "time": event["time"],
        "location": event["location"],
        "address": event["address"],
        "city": event["city"],
        "latitude": event.get("latitude"),
        "longitude": event.get("longitude"),
        "organizer": event.get("organizer", ""),
        "entryFee": event.get("entryFee", ""),
        "carTypes": event.get("carTypes", []),
        "eventType": event.get("eventType", "Car Meet"),
        "photos": event.get("photos", []),
        "attendeeCount": event.get("attendeeCount", 0),
        "userId": _sid(event.get("userId")),
        "isApproved": event.get("isApproved", True),
        "isPopUp": event.get("isPopUp", False),
        "isRecurring": event.get("isRecurring", False),
        "recurrenceDay": event.get("recurrenceDay"),
        "recurrenceEndDate": _isodate(event.get("recurrenceEndDate")),
        "parentEventId": _sid(event.get("parentEventId")),
        "createdAt": _isodate(event.get("createdAt")),
        "contactInfo": event.get("contactInfo", ""),
        "website": event.get("website", ""),
    }


def user_helper(user) -> dict:
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user["name"],
        "nickname": user.get("nickname", ""),
        "profilePic": user.get("profilePic", ""),
        "isAdmin": user.get("isAdmin", False),
        "notificationsEnabled": user.get("notificationsEnabled", True),
        "locationSharingEnabled": user.get("locationSharingEnabled", True),
        "locationPrivate": user.get("locationPrivate", False),
        "latitude": user.get("latitude"),
        "longitude": user.get("longitude"),
        "pushToken": user.get("pushToken", ""),
        "authProvider": user.get("authProvider", "email"),
        "createdAt": _isodate(user.get("createdAt")),
    }


def user_car_helper(car) -> dict:
    return {
        "id": str(car["_id"]),
        "userId": _sid(car["userId"]),
        "make": car["make"],
        "model": car["model"],
        "year": car["year"],
        "color": car.get("color", ""),
        "trim": car.get("trim", ""),
        "engine": car.get("engine", ""),
        "horsepower": car.get("horsepower"),
        "torque": car.get("torque"),
        "transmission": car.get("transmission", ""),
        "drivetrain": car.get("drivetrain", ""),
        "description": car.get("description", ""),
        "photos": car.get("photos", []),
        "videos": car.get("videos", []),
        "modifications": car.get("modifications", []),
        "modificationNotes": car.get("modificationNotes", ""),
        "isPublic": car.get("isPublic", True),
        "instagramHandle": car.get("instagramHandle", ""),
        "youtubeChannel": car.get("youtubeChannel", ""),
        "likes": car.get("likes", 0),
        "views": car.get("views", 0),
        "mainPhotoIndex": car.get("mainPhotoIndex", 0),
        "createdAt": _isodate(car.get("createdAt")),
        "updatedAt": _isodate(car.get("updatedAt")),
    }


def event_photo_helper(photo) -> dict:
    return {
        "id": str(photo["_id"]),
        "eventId": _sid(photo["eventId"]),
        "uploaderId": _sid(photo["uploaderId"]),
        "uploaderName": photo.get("uploaderName", ""),
        "photo": photo["photo"],
        "caption": photo.get("caption", ""),
        "tags": photo.get("tags", []),
        "likes": photo.get("likes", []),
        "likeCount": photo.get("likeCount", 0),
        "createdAt": _isodate(photo.get("createdAt")),
    }


def feedback_helper(feedback) -> dict:
    return {
        "id": str(feedback["_id"]),
        "userId": _sid(feedback["userId"]),
        "userName": feedback["userName"],
        "userEmail": feedback["userEmail"],
        "type": feedback["type"],
        "subject": feedback["subject"],
        "message": feedback["message"],
        "status": feedback.get("status", "new"),
        "adminResponse": feedback.get("adminResponse"),
        "createdAt": _isodate(feedback.get("createdAt")),
        "updatedAt": _isodate(feedback.get("updatedAt")),
    }


def route_helper(route) -> dict:
    return {
        "id": str(route["_id"]),
        "userId": _sid(route["userId"]),
        "userName": route["userName"],
        "name": route["name"],
        "description": route["description"],
        "waypoints": route["waypoints"],
        "distance": route.get("distance"),
        "estimatedTime": route.get("estimatedTime"),
        "scenicHighlights": route.get("scenicHighlights", []),
        "difficulty": route.get("difficulty", "easy"),
        "isPublic": route.get("isPublic", True),
        "likes": route.get("likes", 0),
        "savedBy": route.get("savedBy", []),
        "createdAt": _isodate(route.get("createdAt")),
        "updatedAt": _isodate(route.get("updatedAt")),
    }


# ==================== Push Notifications ====================

async def send_push_notification(push_token: str, title: str, body: str, data: dict = None):
    """Send push notification via Expo's push service"""
    if not push_token or not push_token.startswith('ExponentPushToken'):
        return False

    message = {
        "to": push_token,
        "sound": "default",
        "title": title,
        "body": body,
        "data": data or {}
    }

    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(
                "https://exp.host/--/api/v2/push/send",
                json=message,
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }
            )
            return response.status_code == 200
    except Exception as e:
        logger.error(f"Failed to send push notification: {e}")
        return False


# ==================== Geo Utilities ====================

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in miles using Haversine formula"""
    R = 3959  # Earth's radius in miles

    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


# ==================== OCR Utilities ====================

ocr_reader = None


def get_ocr_reader():
    global ocr_reader
    if ocr_reader is None:
        try:
            import easyocr
            ocr_reader = easyocr.Reader(['en'], gpu=False)
        except ImportError:
            print("WARNING: easyocr not available. OCR functionality disabled.")
            return None
    return ocr_reader


def parse_event_details(text: str) -> dict:
    """Parse extracted text to identify event details"""
    lines = text.split('\n')
    full_text = ' '.join(lines)

    result = {
        "title": "",
        "description": "",
        "date": "",
        "time": "",
        "location": "",
        "address": "",
        "rawText": text
    }

    # Try to find date patterns (various formats)
    date_patterns = [
        r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
        r'((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})',
        r'((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?)',
        r'(\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)',
    ]

    for pattern in date_patterns:
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            result["date"] = match.group(1)
            break

    # Try to find time patterns
    time_patterns = [
        r'(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)',
        r'(\d{1,2}\s*(?:AM|PM|am|pm))',
        r'(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)',
    ]

    for pattern in time_patterns:
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            result["time"] = match.group(1)
            break

    # Try to find location/address patterns
    address_patterns = [
        r'(\d+\s+[A-Za-z\s]+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Way|Pkwy|Parkway)[.,]?\s*(?:[A-Za-z\s]+,?\s*)?(?:OK|Oklahoma)?(?:\s*\d{5})?)',
        r'((?:at|@|location:?)\s*[A-Za-z0-9\s\'\-]+)',
    ]

    for pattern in address_patterns:
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            result["address"] = match.group(1).strip()
            break

    # Try to identify title
    for line in lines:
        line = line.strip()
        if len(line) > 3 and len(line) < 60:
            if not re.search(r'\d{1,2}[/-]\d{1,2}', line) and \
               not re.search(r'\d{1,2}:\d{2}', line) and \
               not re.search(r'(?:AM|PM)', line, re.IGNORECASE):
                result["title"] = line
                break

    # Rest of the text becomes description
    desc_lines = [line.strip() for line in lines if line.strip() and line.strip() != result["title"]]
    result["description"] = '\n'.join(desc_lines[:5])

    return result
