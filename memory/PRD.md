# Oklahoma Bike Meets - Product Requirements Document

## Overview
Oklahoma Bike Meets is a mobile app for motorcycle enthusiasts in Oklahoma to discover events, connect with other riders, and share their bikes.

**Bundle IDs:**
- iOS: `com.velocityvisualcrew.okcbikemeets`
- Android: `com.velocityvisualcrew.okcbikemeets`

**API Endpoint:** `https://api.okcbikemeets.com`

---

## Completed Features

### Authentication
- [x] Email/Password registration and login
- [x] Google Sign-In (OAuth 2.0)
- [x] Apple Sign-In (iOS)
- [x] JWT token-based sessions

### Events
- [x] Event listing with filters
- [x] Event details view
- [x] RSVP functionality
- [x] Event search

### User Features
- [x] User profiles
- [x] Garage (user's bikes)
- [x] Push notifications (Expo + FCM V1)

---

## Session Accomplishments (April 2025)

### ✅ Completed Today

1. **Updated Google Client IDs in Frontend**
   - `login.tsx` and `register.tsx` now use the new Bike Meets Google OAuth Client IDs:
     - Web: `211008012524-scsr0jauel74n096h0mu5jjnq9k86c2v`
     - iOS: `211008012524-uljcvuojvbctv2ot9k8v4fa39f42njck`
     - Android: `211008012524-croc9ef6hoh0f14osh1n22nkhtetafr3`

2. **Created iOS Privacy Manifest**
   - File: `/app/frontend/ios/PrivacyInfo.xcprivacy`
   - Declares: Email, Name, UserID, Location, Photos, DeviceID collection
   - API access reasons for: FileTimestamp, SystemBootTime, DiskSpace, UserDefaults
   - Added `expo-build-properties` plugin to reference the manifest

3. **Updated Apple Sign-In Backend**
   - Fixed bundle ID in JWKS verification: `com.velocityvisualcrew.okcbikemeets`
   - File: `/app/backend/routes/auth.py`

4. **Refactored Event Search Service for Motorcycles**
   - Completely rewrote `/app/backend/event_search_service.py`
   - Replaced car-focused keywords with motorcycle keywords
   - Updated image sources to motorcycle images
   - Added comprehensive 2025-2026 Oklahoma motorcycle event data

5. **Seeded Database with 21 Real Motorcycle Events**
   - Created seed script: `/app/backend/scripts/seed_motorcycle_events.py`
   - Populated database with events including:
     - Weekly bike nights (6 recurring events)
     - 2025 rallies (5 major events)
     - 2026 rallies (10 major events)
   - Total events in database: 87

---

## Event Data Sources

Real Oklahoma motorcycle events were sourced from:
- Route 66 Rallies (route66rallies.com)
- CycleFish Oklahoma events
- Harley-Davidson dealership calendars
- Black Wall Street Rally
- Oklahoma Biker calendar

---

## Pending/Future Tasks

### P1 Tasks
- [ ] Send Test Push Admin Screen - Build frontend UI to test FCM V1 push delivery
- [ ] Additional event discovery via web scraping APIs

### Backlog
- [ ] Club/group features
- [ ] Route planning
- [ ] Live location sharing for group rides
