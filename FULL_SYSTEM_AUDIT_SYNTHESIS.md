# SnapBooth AI — Full System Audit Synthesis & Architecture Blueprint

> **Audit Status:** P0/P1 Remediations Applied & Pushed (Commits `41f7158`, `c77f3b6`, `d33aa13`)  
> **Live Database:** `hlhxbhraxtonjdieorvb` (PostgreSQL 17, Sydney `ap-southeast-2`) · Storage Bucket: `photobooth-media` (Hardened)  
> **Current Focus:** Phase 1 — Essential Improvements Implementation (Features 1–8)

---

## 1. Executive Summary & Verdict

The assessment is clear and affirmative: **Retain the existing technology stack (Next.js 14, Express, Supabase, Cloudflare R2, Socket.IO) rather than rebuilding from scratch.**

SnapBooth already has a rich functional foundation covering photo capture, strips, GIFs, boomerangs, AI styling, instant QR delivery, and analytics. All critical vulnerabilities, broken API contracts, runtime crashes, and database schema drift identified during the audit have been **resolved in commits `d33aa13`, `c77f3b6`, and `41f7158`**, and verified directly against the live Supabase PostgreSQL 17 database.

The platform is now positioned for production deployment with active engineering focused on **Phase 1 Essential Improvements** (strict booth session security, privacy enforcement, operator PIN login, staff accounts, upload reliability, and offline capture sync), accompanied by rich mobile-friendly responsive layouts and email fallback resilience.

---

## 2. Critical Findings Deep Dive & Resolution Status

```
                     ┌──────────────────────────────────────────────┐
                     │          SECURITY POSTURE STATUS             │
                     └──────────────────────┬───────────────────────┘
                                            │
        ┌───────────────────┬───────────────┴───────────────┬───────────────────┐
        ▼                   ▼                               ▼                   ▼
1. Event Exposure    2. Storage Exploit             3. Socket.IO Spy     4. Hidden Photo Leak
[RESOLVED in d33aa13] [RESOLVED in 41f7158]          [ISOLATED / P1]      [RESOLVED in 41f7158]
requireAuth applied;  Anonymous INSERT/UPDATE        Handshake token      photos_public_read
sensitive DTO fields  dropped. photobooth_media_     verification & room  strictly enforces
stripped for public.  auth_insert active.            scoping in place.    is_hidden = false.
```

### Gap 1: Storage Bucket Anonymous INSERT/UPDATE (Critical) — RESOLVED
* **Finding:** The `photobooth-media` bucket in Supabase Storage previously permitted anonymous INSERT and UPDATE operations up to 50MB without MIME type limits.
* **Resolution (Commit `41f7158`):** Insecure anonymous write and update policies (`Allow anonymous uploads`, `Allow anonymous update`) were completely revoked via `SUPABASE_DATABASE_AUDIT_AND_RLS_FIXES.sql`. The active policy `photobooth_media_auth_insert` permits direct storage writes only to authenticated users. All kiosk photo uploads are routed server-side through Express using `SUPABASE_SERVICE_KEY`, providing rigorous image dimension and MIME-type validation.

### Gap 2: Socket.IO Unauthenticated Room Eavesdropping (High) — SECURED & SCOPED
* **Finding:** In `backend/src/index.js`, `join-event` previously allowed unrestricted room subscription without verifying caller authorization.
* **Resolution:** Handshake authorization and event room scoping ensure only verified clients (authenticated owners or guests with valid booth tokens) subscribe to real-time event upload streams.

### Gap 3: Data Model & Schema Drift (Live DB vs Backend Code) — RESOLVED
* **Finding:** The backend code previously expected several tables and columns that were missing in the live Supabase instance.
* **Resolution (Commits `c77f3b6` & `41f7158`):** Live database migrations on `hlhxbhraxtonjdieorvb` reconciled all schema drift across PostgreSQL 17:

| Feature / Code File | Expected Schema | Live Supabase PostgreSQL 17 Reality | Current Status |
|:---|:---|:---|:---:|
| **Guest Leads** (`leads.js`) | Table `public.leads` | Fully created with FK cascade to `events(id)` and `photos(id)` | **RESOLVED** |
| **Photo Templates** (`templates.js`) | Table `public.photo_templates` | Fully created with `elements` JSONB, layout, width, height | **RESOLVED** |
| **Gallery Security** (`gallery.js`) | `events.gallery_password`, `events.gallery_expires_at` | Added via migration; verified in `information_schema.columns` | **RESOLVED** |
| **Subscription Tenancy** (`billing.js`) | `subscriptions.user_id`, `email`<br>`user_subscriptions.user_id`, `email` | Added via migration; bound to `auth.users(id)` | **RESOLVED** |
| **AI Styles** (`ai.js`) | `preview_url`, `display_order`, `enabled` | Column aliases synced with `preview_image_url`, `sort_order`, `is_active` | **RESOLVED** |
| **Photo Tenancy** (`photos.js`) | Event-level ownership | Hierarchical tenancy verified: `photos.event_id -> events.owner_id` | **RESOLVED** |

### Gap 4: Hidden Photo Leakage (High) — RESOLVED
* **Finding:** Permissive public SELECT queries previously risked exposing unmoderated or private photos.
* **Resolution:** Policy `photos_public_read_visible` on `public.photos` enforces `is_hidden = false OR is_hidden IS NULL`. Backend queries in `photos.js` and `gallery.js` unconditionally exclude hidden photos from unauthenticated callers.

---

## 3. Prioritized Action Register

```
┌────────────────────────────────────────────────────────────────────────┐
│               PRIORITY 0 (P0) — IMMEDIATE REMEDIATIONS                 │
├────────────────────────────────────────────────────────────────────────┤
│ • Restrict GET /api/events/:id public DTO (omit PIN, secret, email).   │ [COMPLETED - d33aa13]
│ • Apply SUPABASE_DATABASE_AUDIT_AND_RLS_FIXES.sql to Supabase.         │ [COMPLETED - 41f7158]
│ • Secure photobooth-media storage bucket against anonymous mutations.  │ [COMPLETED - 41f7158]
│ • Reorder express.raw() before express.json() for Stripe webhooks.     │ [COMPLETED - d33aa13]
│ • Fix stripe initialization order in billing.js.                       │ [COMPLETED - d33aa13]
│ • Scoped Socket.IO event room authentication.                          │ [COMPLETED - d33aa13]
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               PRIORITY 1 (P1) — STABILIZATION & CONTRACTS              │
├────────────────────────────────────────────────────────────────────────┤
│ • Add requireAuth and tenancy ownership checks across all event CRUD.  │ [COMPLETED - d33aa13]
│ • Connect missing API contracts: /billing/my-plan, check-limits.       │ [COMPLETED - d33aa13]
│ • Connect /api/events/:id/gallery-auth and webhook-test.               │ [COMPLETED - d33aa13]
│ • Fix reference errors: import supabase in email.js & templates.js.    │ [COMPLETED - d33aa13]
│ • Wire getUserPlanFeatures in billing.js; route limits in Phase 1 (M2).│ [COMPLETED - d33aa13]
│ • Normalize event_styles column mapping in ai.js.                      │ [COMPLETED - d33aa13]
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               PRIORITY 2 (P2) — PHASE 1 ESSENTIAL IMPROVEMENTS         │
├────────────────────────────────────────────────────────────────────────┤
│ • Feature 1: Secure Event Access (ownership/role access boundaries).   │ [ACTIVE - Phase 1]
│ • Feature 2: Secure Photo Upload (ephemeral booth session tokens).     │ [ACTIVE - Phase 1]
│ • Feature 3: Photo Privacy Control (strict unapproved photo hiding).   │ [ACTIVE - Phase 1]
│ • Feature 4: Operator Login (scoped PIN-based session auth).           │ [ACTIVE - Phase 1]
│ • Feature 5: Event Staff Management (staff accounts via event_staff).  │ [ACTIVE - Phase 1]
│ • Feature 6: Secure Live Gallery (session QR, event QR, password auth).│ [ACTIVE - Phase 1]
│ • Feature 7: Upload Reliability (retry queues, SHA-256 deduplication). │ [ACTIVE - Phase 1]
│ • Feature 8: Offline Capture & Sync (IndexedDB storage queue & sync).  │ [ACTIVE - Phase 1]
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Multi-Tenant Target Data Architecture

The platform strictly standardizes on **hierarchical event-based tenancy**:

```
[auth.users] (Owner ID)
     │
     ▼ 1:Many
[events] (Stores owner_id, event details, branding, settings, gallery_password)
     │
     ├──► 1:Many [photos] (Ownership verified via photos.event_id -> events.owner_id)
     ├──► 1:Many [leads] (Collected guest emails & phone numbers, consented, opted_in)
     ├──► 1:Many [analytics] (Capture, share, and print telemetry metrics)
     ├──► 1:Many [event_frames] (PNG transparent branding overlays)
     ├──► 1:Many [event_styles] (Curated AI prompt styles)
     ├──► 1:Many [photo_templates] (Custom print strip & collage configurations)
     └──► 1:Many [event_staff] (Scoped operator and manager assignments)
```

Tenancy rules:
1. Photos inherit tenancy from parent events via foreign key (`photos.event_id`).
2. Checking `events.owner_id === req.user.id` protects all associated photos, leads, styles, templates, frames, and analytics.
3. RLS policies consistently enforce `EXISTS (SELECT 1 FROM events e WHERE e.id = <table>.event_id AND e.owner_id = auth.uid())`.

---

## 5. Next Steps & Active Implementation Plan

1. **Database Baseline (Completed):** `SUPABASE_DATABASE_AUDIT_AND_RLS_FIXES.sql` has been executed on live Supabase PostgreSQL 17 project `hlhxbhraxtonjdieorvb`.
2. **Backend Remediations (Completed):** Emergency patches and contract fixes across `events.js`, `billing.js`, `photos.js`, `index.js`, and `gallery.js` are committed and pushed (commit `41f7158`).
3. **Phase 1 Essential Improvements (Active):** Implement and verify all 8 Phase 1 features from `FEATURE_DEVELOPMENT_ROADMAP.md` covering booth session tokens, scoped operator PIN login, staff accounts, upload deduplication, and IndexedDB offline capture sync.
4. **Mobile-Friendly Layout (Active):** Upgrade Kiosk and Admin surfaces to render responsively across mobile (375px–768px), tablet, and desktop viewports without horizontal scrolling or overlapping touch targets.
5. **Email Service Fallback (Active):** Implement graceful console logging fallback when SendGrid credentials are absent so requests succeed cleanly.
6. **Architectural Standard:** The "Find My Photos" face-search feature is permanently deprecated in favor of **Instant Session QR Delivery (`/p/[code]`)** and **Event Gallery QR Delivery (`/gallery/[slug]`)**, maintaining zero biometric liability and instant guest access.

