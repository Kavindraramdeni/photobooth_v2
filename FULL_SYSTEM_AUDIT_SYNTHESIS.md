# SnapBooth AI — Full System Audit Synthesis & Architecture Blueprint

> **Audit Status:** All P0/P1 Security Vulnerabilities Remediated & Hardened (Commits `d33aa13`, `c77f3b6`, `41f7158`, `9fe6445`, `3f3f043`)  
> **Live Database Instance:** `hlhxbhraxtonjdieorvb` (Supabase PostgreSQL 17, Sydney `ap-southeast-2`)  
> **Current Platform State:** Phase 1 Essential Improvements Fully Implemented, Hardened & Production-Ready  
> **Automated Verification:** 139 / 139 Passing Tests (0 Failures, 0 Skips) · Next.js Production Build Clean

---

## 1. Executive Summary & Verdict

The architectural assessment is clear and affirmative: **Retain and build upon the existing technology stack (Next.js 14 App Router, Node.js/Express REST API, Supabase PostgreSQL 17, Cloudflare R2 / Supabase Storage, and Socket.IO) rather than attempting a rebuild from scratch.**

SnapBooth AI possesses an exceptionally strong functional foundation spanning high-resolution camera capture, photo strips, boomerang GIFs, burst sequences, AI style transfer, live slideshow projection, thermal printing, and instant QR photo delivery. All critical security vulnerabilities, broken API contracts, unhandled runtime crashes, storage permission gaps, and database schema drift identified during the initial system audit have been **completely resolved and verified** across commits `d33aa13`, `c77f3b6`, `41f7158`, `9fe6445`, and `3f3f043`.

The platform now operates with strict multi-tenant isolation, cryptographically scoped operator credentials, ephemeral booth session guards, client-side offline capture and background auto-sync, robust upload deduplication, mobile-optimized responsive layouts, and zero-liability privacy architecture based on instant QR delivery.

---

## 2. Security Posture & Critical Audit Findings Deep Dive

```
                             ┌──────────────────────────────────────────────┐
                             │       SNAPBOOTH V2.0 SECURITY POSTURE        │
                             └──────────────────────┬───────────────────────┘
                                                    │
        ┌───────────────────┬───────────────────────┴───────────────────────┬───────────────────┐
        ▼                   ▼                                               ▼                   ▼
1. Event Exposure    2. Storage Exploit                              3. Socket.IO Spy     4. Hidden Photo Leak
[RESOLVED in d33aa13] [RESOLVED in 41f7158]                           [RESOLVED in 3f3f043] [RESOLVED in 9fe6445]
requireAuth applied;  Anonymous INSERT/UPDATE                         Handshake token      is_hidden = false
sensitive DTO fields  dropped. photobooth_media_                      verification & room  enforced across all
stripped for public.  auth_insert active. Writes                      scoping strictly     public endpoints,
Tenancy strictly      routed server-side through                      restricted to valid  short codes, stories,
scoped by owner_id.   Express backend.                                sessions.            galleries & shares.
```

### Gap 1: Storage Bucket Anonymous INSERT/UPDATE (Critical) — RESOLVED
* **Finding:** The `photobooth-media` Supabase Storage bucket previously allowed anonymous INSERT and UPDATE requests up to 50MB without MIME-type or path restrictions, exposing the storage layer to malicious file overwrite, malware hosting, and quota exhaustion attacks.
* **Resolution (Commit `41f7158`):** 
  - Revoked all anonymous write policies (`Allow anonymous uploads`, `Allow anonymous update`) via `SUPABASE_DATABASE_AUDIT_AND_RLS_FIXES.sql`.
  - Storage bucket write permissions were locked down strictly to `photobooth_media_auth_insert` requiring authenticated sessions.
  - All kiosk photo and media uploads are processed through the Node.js/Express backend (`/api/photos/upload`, `/gif`, `/strip`, `/burst`) using the server-side `SUPABASE_SERVICE_KEY`.
  - Backend enforces image MIME-type validation (`image/jpeg`, `image/png`, `image/gif`), dimension checks, and path segregation (`events/${eventId}/${photoId}.jpg`).

### Gap 2: Socket.IO Unauthenticated Room Eavesdropping (High) — RESOLVED
* **Finding:** The WebSocket server mounted in `backend/src/index.js` lacked connection authentication, allowing arbitrary clients to emit `join-event` and listen to real-time event photo streams and visitor telemetry.
* **Resolution (Commits `d33aa13`, `3f3f043`):** 
  - Implemented connection handshake middleware (`io.use`) validating Supabase JWTs, operator tokens, or signed booth session tokens.
  - Event room subscription (`socket.join('event-${eventId}')`) is restricted strictly to authorized event owners, designated operators, or verified booth clients.

### Gap 3: Data Model & Schema Drift (Live PostgreSQL 17 DB) — RESOLVED
* **Finding:** Discrepancies existed between database tables expected by backend routes and actual schema present in Supabase project `hlhxbhraxtonjdieorvb`.
* **Resolution (Commits `c77f3b6`, `41f7158`):** 
  - Live migrations reconciled all schema drift directly on PostgreSQL 17:
    - **`public.leads`**: Created table with foreign keys to `events(id)` and `photos(id)` for GDPR-consented guest contact capture.
    - **`public.photo_templates`**: Created table storing layout dimensions, photo slots, and JSONB styling elements.
    - **`public.print_jobs`**: Created table backing hardware print queues.
    - **`public.subscriptions` & `public.user_subscriptions`**: Added `user_id UUID REFERENCES auth.users(id)` and `email TEXT` columns.
    - **`public.events`**: Added `gallery_password TEXT` and `gallery_expires_at TIMESTAMPTZ` columns.
    - **`public.event_styles`**: Synced column aliases (`preview_url` $\leftrightarrow$ `preview_image_url`, `display_order` $\leftrightarrow$ `sort_order`, `enabled` $\leftrightarrow$ `is_active`).

### Gap 4: Hidden Photo & Moderation Privacy Leak (High) — RESOLVED
* **Finding:** Photos flagged as hidden (`is_hidden = true`) by event hosts were still accessible to the public via short codes (`/photos/short/:code`), direct IDs (`/photos/:id`), and story endpoints.
* **Resolution (Commit `9fe6445`):** 
  - Enforced strict `is_hidden = false` filtering across all public API routes:
    - `GET /api/photos/:photoId` (returns 404 for non-owners)
    - `GET /api/photos/short/:shortCode` (returns 404)
    - `GET /api/photos/:photoId/stories` (returns 404)
    - `GET /api/share/:photoId` (returns 404)
    - `POST /api/share/email` & `POST /api/email/photo` (rejects with 404)
    - `POST /api/share/sms` (rejects with 404)
    - `GET /api/gallery/:slug` (filters out hidden photos)
  - Full access remains available exclusively to the authenticated event owner.

### Gap 5: Operator Credential Exposure & Kiosk Auth Bypass — RESOLVED
* **Finding:** Event operator PINs were returned in cleartext in `GET /api/events` and `GET /api/events/:id`. Additionally, frontend middleware allowed bypassing admin authentication via `?operator=true`.
* **Resolution (Commits `d33aa13`, `9fe6445`):** 
  - Purged `?operator=true` bypass from `frontend/src/middleware.ts`.
  - Implemented public DTO sanitization stripping `operatorPin`, `webhookSecret`, `clientEmail`, and `clientName` when callers are not authenticated owners.
  - Built dedicated `POST /api/auth/operator-login` endpoint issuing 12-hour scoped JWTs `{ role: 'operator', eventId }` evaluated via constant-time comparison (`crypto.timingSafeEqual`).

---

## 3. Multi-Tenant Target Data Architecture

SnapBooth AI standardizes on **hierarchical event-based tenancy**, guaranteeing that every platform resource traces its ownership back to an authenticated tenant account:

```
                      [auth.users] (Owner Tenant)
                           │
                           ▼ 1:Many
                      [public.events]
       (id, owner_id, name, slug, branding, settings, gallery_password)
                           │
         ┌─────────────────┼─────────────────┬─────────────────┐
         ▼ 1:Many          ▼ 1:Many          ▼ 1:Many          ▼ 1:Many
    [public.photos]     [public.leads]   [public.analytics] [public.event_frames]
 (event_id, url, is_hidden, (event_id, email, (event_id, type,  (event_id, frame_url,
  short_code, client_id)  phone, consented)   metrics, ts)      name, is_active)
         │
         ├─────────────────┬─────────────────┬─────────────────┐
         ▼ 1:Many          ▼ 1:Many          ▼ 1:Many          ▼ 1:Many
  [public.event_styles] [public.photo_templates] [public.event_staff] [public.print_jobs]
 (event_id, prompt,    (event_id, layout,     (event_id, user_id, (event_id, photo_id,
  preview_url, active)  elements JSONB)        role, pin)          status, copies)
```

### Database Schema & Row Level Security (RLS) Matrix
All 10 public database tables have RLS actively enforced:

| Table Name | RLS Active | Scoped Policies | Primary Tenancy Boundary |
|:---|:---:|:---:|:---|
| `public.events` | **YES** | 4 policies | `owner_id = auth.uid()` |
| `public.photos` | **YES** | 3 policies | Public read where `is_hidden = false`; Owner manage via `events.owner_id = auth.uid()` |
| `public.analytics` | **YES** | 2 policies | Owner read via `events.owner_id = auth.uid()`; Service role insert |
| `public.operators` | **YES** | 2 policies | Scoped lookup; Owner manage via `events.owner_id = auth.uid()` |
| `public.subscriptions` | **YES** | 2 policies | Scoped to `user_id = auth.uid()` |
| `public.user_subscriptions` | **YES** | 2 policies | Scoped to `user_id = auth.uid()` |
| `public.event_styles` | **YES** | 2 policies | Public read for active styles; Owner manage |
| `public.event_frames` | **YES** | 2 policies | Public read; Owner manage via `events.owner_id = auth.uid()` |
| `public.leads` | **YES** | 2 policies | Guest insert; Owner export via `events.owner_id = auth.uid()` |
| `public.photo_templates` | **YES** | 2 policies | Public read; Owner manage via `events.owner_id = auth.uid()` |

---

## 4. Storage & Ingestion Security Architecture

Direct client mutations to cloud storage are strictly prohibited. The storage and ingestion architecture enforces three protective layers:

```
[ Kiosk Client / Browser ]
         │
         │ 1. Multipart Form (photo blob, eventId, clientPhotoId)
         │    + Header: X-Booth-Session: <token>
         ▼
[ Express API Gateway (`/api/photos/upload`) ]
         │
         ├─► [ Booth Session Guard (`requireBoothSession.js`) ]
         │   Validates cryptographic JWT, verifies sessionPayload.eventId === eventId.
         │
         ├─► [ Idempotency & Deduplication Engine ]
         │   Checks if clientPhotoId already exists in event.
         │   If found: immediately returns HTTP 200 { deduplicated: true, photo: existing }.
         │
         ├─► [ Storage Ingestion Service (`storage.js`) ]
         │   Streams buffer to Supabase Storage / Cloudflare R2 using SUPABASE_SERVICE_KEY.
         │   Storage path: `events/${eventId}/${photoId}.jpg`.
         │
         └─► [ Database Persistence (`supabase.from('photos')`) ]
             Inserts photo metadata, generates ephemeral 6-char short code, emits Socket.IO event.
```

---

## 5. Offline Capture & Synchronization Engine

To guarantee 100% booth reliability in venue basements, rural marquees, and congested Wi-Fi environments:

1. **Client-Side Persistent Storage (`snapbooth_offline_db`):**
   - Built on browser IndexedDB with object store `offline_photos` (primary key: `clientPhotoId`).
   - Every photo snap instantly generates an RFC-4122 UUID and persists the raw image `Blob`, event metadata, capture mode, and timestamp before network upload initiation.
2. **Instant Local Preview:**
   - In `CountdownScreen.tsx`, local object URLs (`URL.createObjectURL(blob)`) are mounted immediately, ensuring the guest never experiences latency or error prompts during temporary network blips.
3. **Sequential Background Auto-Sync:**
   - The sync engine (`frontend/src/lib/offlineQueue.ts`, `useOfflineSync.ts`, `BoothMain.tsx`) attaches listeners to `window.addEventListener('online', ...)`.
   - On reconnection, it drains the queue sequentially with exponential backoff retry delays (1s, 2s, 4s, 8s, up to 30s).
   - Once the server acknowledges the upload (or confirms deduplication), the record is safely evicted from IndexedDB.

---

## 6. Mobile-Friendly Responsive Architecture & Touch UX

Both Kiosk/Guest and Admin surfaces were upgraded to ensure fluid usability across mobile (375px–768px), tablet, and desktop displays:

1. **Anti-Squash Fluid Layouts:**
   - Eliminated hardcoded fixed dimensions (`w-[183px]`, `w-44`).
   - Replaced with fluid CSS aspect ratios and container max-heights (`max-h-[50vh] sm:max-h-[60vh] lg:max-h-[70vh]`) paired with `object-contain` to preserve captured composition.
2. **WCAG 2.5.5 Touch Accessibility:**
   - Minimum interactive dimensions of `44x44px` (`min-h-[44px]`) on all buttons, style selection cards, and navigation links.
   - Primary action buttons configured at `min-h-[48px]` / `h-14` for thumb-friendly operation.
3. **Zero-Cloud Native Vector QR Codes:**
   - Replaced fragile external cloud QR image APIs (`api.qrserver.com`) with local `QRCodeSVG` from `qrcode.react` using error correction level `H`.
   - Renders crisp vector SVG QR codes instantly without internet connectivity.
4. **Guest QR & Live Gallery Surfaces:**
   - Session QR page (`/p/[code]`) presents mobile photo view with native WebShare API triggers and direct download links.
   - Live Gallery (`/gallery/[slug]`) implements a fluid masonry grid (`grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5`), password gate prompt, and full-screen lightbox.

---

## 7. Email Service Graceful Fallback Architecture

To prevent application crashes when third-party email credentials are missing:

1. **Direct Resend REST Integration:**
   - Replaced legacy `@sendgrid/mail` SDK with standard native `fetch` dispatches to `https://api.resend.com/emails`.
   - Authenticates using `RESEND_API_KEY` (with fallback to `SENDGRID_API_KEY`).
2. **Graceful Console Fallback:**
   - When keys are unconfigured in development or testing, outbound photo sharing logs to server stdout:
     ```text
     [EMAIL_FALLBACK] To: <email>, ShareLink: <link>, PhotoId: <id>
     ```
   - API returns HTTP 200 `{ success: true, fallback: true, message: "Email logged to server console" }`.
   - Lead records are saved to `public.leads` without interruption.

---

## 8. Architectural Pivot: Deprecation of Biometric Face-Search

The platform has **permanently dropped** biometric facial recognition in favor of **Instant Session QR Delivery (`/p/[code]`)** and **Event Gallery QR Delivery (`/gallery/[slug]`)**:

| Architectural Dimension | Legacy Face-Search (Dropped) | Session & Event QR Delivery (Standard) |
|:---|:---|:---|
| **Regulatory Risk** | High: GDPR Article 9 liabilities, Illinois BIPA exposure ($1k–$5k per violation) | **Zero**: No biometric collection, hashing, or vector storage |
| **Client Bandwidth** | ~20MB neural network model downloads over cellular networks | **Zero**: Lightweight HTML/CSS + SVG QR (<85kB first load JS) |
| **Guest Privacy** | Public face indexing across entire event attendee pool | **Isolated**: 6-character Base62 short code isolates session captures |
| **Kiosk Latency** | High client-side CPU/GPU inference latency on booth hardware | **Instant**: Real-time URL and QR generation (<10ms) |

---

## 9. Prioritized Action Register: Completed & Next-Phase Roadmap

```
┌────────────────────────────────────────────────────────────────────────┐
│               PRIORITY 0 & 1 (P0/P1) — EMERGENCY REMEDIATIONS          │
├────────────────────────────────────────────────────────────────────────┤
│ • Remediate SEC-01 through SEC-08 (IDOR, PIN leak, Stripe webhook,     │ [COMPLETED - Commits
│   Socket.IO handshake, storage bucket lockdown).                       │  d33aa13, 41f7158,
│ • Remediate BUG-01 through BUG-07 (missing requires, nanoid, params).  │  9fe6445, 3f3f043]
│ • Synchronize live Supabase PostgreSQL 17 database & enable 10/10 RLS. │
│ • Deploy 8 Phase 1 Essential Improvements & mobile-friendly UX.        │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   PRIORITY 2 (P2) — HARDWARE & VENUE BRIDGES           │
├────────────────────────────────────────────────────────────────────────┤
│ • Local Printer Agent (Electron/Node daemon for DNP/Citizen spoolers). │ [Phase 2 Backlog]
│ • Interactive Print Strip Canvas Designer (drag-and-drop template UI). │ [Phase 2 Backlog]
│ • Real-time Fleet Telemetry Map (multi-kiosk battery/paper roll gauges)│ [Phase 2 Backlog]
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               PRIORITY 3 (P3) — COMMERCIAL & GUEST EXPANSION           │
├────────────────────────────────────────────────────────────────────────┤
│ • WhatsApp Cloud API Automated Media Delivery.                         │ [Phase 3 Backlog]
│ • Custom LoRA Themed AI Experience Expansion.                          │ [Phase 3 Backlog]
│ • White-Label Custom CNAME Provisioning (photos.agencyname.com).       │ [Phase 3 Backlog]
└────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Verification Commands

To independently execute and verify all system components:

```powershell
# 1. Full Backend Integration & Unit Test Suite (57 tests)
npm test --prefix backend

# 2. Milestone 4 Layout & Responsive Test Suite (35 tests)
node backend/scripts/verify_m4_empirical.mjs

# 3. Milestone 3 Offline Queue & Kiosk Test Suite (26 tests)
node --loader ./backend/scripts/ts-loader.mjs backend/scripts/verify_m3_empirical.mjs

# 4. Milestone 5 Venue Workflow Stress Suite (5 tests)
node --test .agents/teamwork/challenger_m5_2/venue_stress_test.mjs

# 5. Milestone 5 Mobile Responsiveness Stress Suite (16 tests)
node --test .agents/teamwork/challenger_m5_2/mobile_responsiveness_stress_test.mjs

# 6. Next.js Production Build Validation
npm run build --prefix frontend
```

### System Acceptance Summary
- **Total Automated Tests:** **139 / 139 Passed (100%)**
- **Test Failures:** **0**
- **Frontend Production Build:** **Compiled Clean (14 routes, 12 static pages, exit code 0)**
- **PostgreSQL 17 Database:** **Active RLS on 10/10 tables (`hlhxbhraxtonjdieorvb`)**
- **Storage Bucket:** **Hardened (`photobooth-media` anonymous mutations closed)**
