from pydantic import BaseModel, Field
from typing import List, Optional, Dict


# ==================== Event Models ====================

class EventCreate(BaseModel):
    title: str
    description: str
    date: str
    time: str
    location: str
    address: str
    city: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    organizer: str = ""
    entryFee: str = ""
    bikeTypes: List[str] = []
    eventType: str = "Bike Meet"
    photos: List[str] = []
    userId: Optional[str] = None
    contactInfo: str = ""
    website: str = ""
    isPopUp: bool = False
    isRecurring: bool = False
    recurrenceDay: Optional[int] = None  # 0=Sunday, 1=Monday, ..., 6=Saturday
    recurrenceEndDate: Optional[str] = None  # End date for recurring events (YYYY-MM-DD)


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    location: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    organizer: Optional[str] = None
    entryFee: Optional[str] = None
    bikeTypes: Optional[List[str]] = None
    eventType: Optional[str] = None
    photos: Optional[List[str]] = None
    contactInfo: Optional[str] = None
    website: Optional[str] = None
    isApproved: Optional[bool] = None
    isRecurring: Optional[bool] = None
    recurrenceDay: Optional[int] = None
    recurrenceEndDate: Optional[str] = None


class EventPhotoUpload(BaseModel):
    eventId: str
    uploaderId: str
    uploaderName: str
    photo: str  # Base64 encoded image
    caption: Optional[str] = ""


class PhotoTagCreate(BaseModel):
    userId: str
    bikeId: str
    bikeInfo: Optional[str] = ""  # e.g., "2022 Harley-Davidson Street Glide"


# ==================== User Models ====================

class UserCreate(BaseModel):
    email: str
    name: str
    password: str
    nickname: str = ""
    profilePic: str = ""
    isAdmin: bool = False
    notificationsEnabled: bool = True
    locationSharingEnabled: bool = True


class UserUpdate(BaseModel):
    name: Optional[str] = None
    nickname: Optional[str] = None
    profilePic: Optional[str] = None
    notificationsEnabled: Optional[bool] = None
    locationSharingEnabled: Optional[bool] = None
    locationPrivate: Optional[bool] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    pushToken: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str


class DeleteAccountRequest(BaseModel):
    user_id: str
    email: str
    password: str = ""


class GoogleAuthRequest(BaseModel):
    session_id: str


class GoogleAuthComplete(BaseModel):
    email: str
    nickname: str
    googleId: str
    name: str
    picture: str = ""


class AppleAuthRequest(BaseModel):
    identityToken: str
    fullName: Optional[str] = None
    email: Optional[str] = None


class AppleAuthComplete(BaseModel):
    email: str
    nickname: str
    appleId: str
    name: str


class PushTokenRegister(BaseModel):
    userId: str
    pushToken: str


# ==================== Garage / User Bike Models ====================

class Modification(BaseModel):
    category: str  # e.g., "Engine", "Suspension", "Exhaust", "Handlebars", "Wheels"
    name: str
    brand: Optional[str] = None
    description: Optional[str] = None
    cost: Optional[float] = None


class UserBikeCreate(BaseModel):
    userId: str
    make: str
    model: str
    year: str
    color: str = ""
    trim: str = ""
    engine: str = ""
    displacement: Optional[int] = None
    engineType: str = ""  # V-Twin, Inline-4, Single, Parallel Twin, Boxer, etc.
    torque: Optional[int] = None
    transmission: str = ""
    drivetrain: str = ""
    description: str = ""
    photos: List[str] = []
    videos: List[str] = []
    modifications: List[Modification] = []
    modificationNotes: str = ""
    isPublic: bool = True
    instagramHandle: str = ""
    youtubeChannel: str = ""
    mainPhotoIndex: int = 0
    isActive: bool = True
    bikeId: Optional[str] = None


class UserBikeUpdate(BaseModel):
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[str] = None
    color: Optional[str] = None
    trim: Optional[str] = None
    engine: Optional[str] = None
    displacement: Optional[int] = None
    torque: Optional[int] = None
    transmission: Optional[str] = None
    drivetrain: Optional[str] = None
    description: Optional[str] = None
    photos: Optional[List[str]] = None
    videos: Optional[List[str]] = None
    modifications: Optional[List[Modification]] = None
    modificationNotes: Optional[str] = None
    isPublic: Optional[bool] = None
    instagramHandle: Optional[str] = None
    youtubeChannel: Optional[str] = None
    mainPhotoIndex: Optional[int] = None


# Keep aliases for backwards compatibility
UserCarCreate = UserBikeCreate
UserCarUpdate = UserBikeUpdate


# ==================== Messaging Models ====================

class MessageCreate(BaseModel):
    senderId: str
    recipientId: str
    content: str


# ==================== Location / Nearby Models ====================

class LocationUpdate(BaseModel):
    userId: str
    latitude: float
    longitude: float
    isSharing: bool = True
    shareUntil: Optional[str] = None


class MeetupInviteRequest(BaseModel):
    senderId: str
    senderName: str
    senderLatitude: float
    senderLongitude: float
    radius: float
    message: str
    isCustomMessage: bool = False


class PopupInviteRequest(BaseModel):
    senderId: str
    senderName: str
    recipientIds: List[str]
    message: str
    shareLocation: bool = False
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    locationDuration: int = 30  # minutes, max 60


class PopupRsvpRequest(BaseModel):
    messageId: str
    userId: str
    userName: str
    status: str  # "attending" or "declined"


# ==================== Performance Models ====================

class PerformanceRunCreate(BaseModel):
    userId: str
    bikeInfo: str
    zeroToSixty: Optional[float] = None
    zeroToHundred: Optional[float] = None
    quarterMile: Optional[float] = None
    quarterMileSpeed: Optional[float] = None  # Trap speed at end of 1/4 mile
    topSpeed: Optional[float] = None
    location: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    isManualEntry: bool = False


class PerformanceRunUpdate(BaseModel):
    bikeInfo: Optional[str] = None
    zeroToSixty: Optional[float] = None
    zeroToHundred: Optional[float] = None
    quarterMile: Optional[float] = None
    quarterMileSpeed: Optional[float] = None
    topSpeed: Optional[float] = None
    location: Optional[str] = None
    userId: Optional[str] = None
    isManualEntry: Optional[bool] = None


# ==================== OCR Models ====================

class OCRRequest(BaseModel):
    image: str  # Base64 encoded image


# ==================== RSVP Models ====================

class RSVPCreate(BaseModel):
    userId: str
    eventId: str


class RSVPLegacyCreate(BaseModel):
    """Legacy RSVP model with status field (for /rsvps endpoint)"""
    userId: str
    eventId: str
    status: str = "going"


# ==================== Favorites & Comments Models ====================

class FavoriteCreate(BaseModel):
    userId: str
    eventId: str


class CommentCreate(BaseModel):
    eventId: str
    userId: str
    userName: str
    text: str
    rating: Optional[int] = None


class GarageCommentCreate(BaseModel):
    bikeId: str
    userId: str
    userName: str
    text: str


# ==================== Club Models ====================

class ClubCreate(BaseModel):
    name: str
    description: str
    location: str
    city: str
    bikeTypes: List[str] = []
    contactInfo: str = ""
    website: str = ""
    facebookGroup: str = ""
    meetingSchedule: str = ""
    focus: str = ""
    userId: Optional[str] = None


class ClubUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    city: Optional[str] = None
    bikeTypes: Optional[List[str]] = None
    contactInfo: Optional[str] = None
    website: Optional[str] = None
    facebookGroup: Optional[str] = None
    meetingSchedule: Optional[str] = None
    memberCount: Optional[str] = None
    photos: Optional[List[str]] = None


# ==================== Feedback Models ====================

class FeedbackCreate(BaseModel):
    userId: str
    userName: str
    userEmail: str
    type: str  # "bug", "suggestion", "other"
    subject: str
    message: str


class FeedbackResponse(BaseModel):
    id: str
    userId: str
    userName: str
    userEmail: str
    type: str
    subject: str
    message: str
    status: str  # "new", "in_progress", "resolved", "closed"
    adminResponse: Optional[str] = None
    createdAt: str
    updatedAt: Optional[str] = None


# ==================== Route Planning Models ====================

class Waypoint(BaseModel):
    latitude: float
    longitude: float
    name: Optional[str] = None
    order: int


class RouteCreate(BaseModel):
    userId: str
    userName: str
    name: str
    description: str
    waypoints: List[Waypoint]
    distance: Optional[float] = None  # in miles
    estimatedTime: Optional[str] = None  # e.g., "2h 30m"
    scenicHighlights: List[str] = []  # e.g., ["Lake view", "Mountain pass"]
    difficulty: str = "easy"  # easy, moderate, challenging
    isPublic: bool = True


class RouteUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    waypoints: Optional[List[Waypoint]] = None
    distance: Optional[float] = None
    estimatedTime: Optional[str] = None
    scenicHighlights: Optional[List[str]] = None
    difficulty: Optional[str] = None
    isPublic: Optional[bool] = None
