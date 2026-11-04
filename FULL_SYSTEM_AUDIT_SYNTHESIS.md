# SnapBooth AI — Full System Audit Synthesis & Architecture Blueprint

**Source Repository:** `Kavindraramdeni/photobooth_v2`  
**Live Database:** `hlhxbhraxtonjdieorvb` (PostgreSQL 17, Sydney ap-southeast-2)  
**Storage Bucket:** `photobooth-media`

---

## 1. Executive Summary & Verdict

The assessment is clear and affirmative: **Keep the existing technology stack (Next.js 14, Express, Supabase, Cloudflare R2, Socket.IO) rather than rebuilding from scratch.** 

SnapBooth already has a rich functional foundation covering photo capture, strips, GIFs, boomerangs, AI styling, instant QR delivery, and analytics. However, the system currently suffers from **disconnected contracts, database schema drift, storage permission leaks, and broken authorization boundaries**.

---

## 2. Critical Findings Deep Dive

```
                     ┌──────────────────────────────────────────────┐
                     │          CRITICAL SECURITY GAPS              │
                     └──────────────────────┬───────────────────────┘
                                            │
        ┌───────────────────┬───────────────┴───────────────┬───────────────────┐
        ▼                   ▼                               ▼                   ▼
1. Event Exposure    2. Storage Exploit             3. Socket.IO Spy     4. Hidden Photo Leak
Unauthenticated      photobooth-media bucket        join-event(id)       Permissive OR policy
select('*') leaks    allows anonymous INSERT        has 0 authentication. combines with public
client email, PIN,   and UPDATE up to 50MB          Any client can spy   SELECT, exposing
and webhook secret.  without MIME limits.           on other events.     moderated photos.
```

### Gap 1: Storage Bucket Anonymous INSERT/UPDATE (Critical)
* **Finding:** The `photobooth-media` bucket in Supabase Storage currently has:
  * Public read access
  * **Anonymous INSERT permission**
  * **Anonymous UPDATE permission**
  * Unrestricted MIME types & 50MB file limit
* **Threat:** Any external party can upload malicious payloads, overwrite existing event assets, or consume gigabytes of storage directly against the Supabase storage endpoint without calling the backend.
* **Remediation:** Revoke anonymous write/update policies on `storage.objects`. Route all booth media writes through the backend (which uses `SUPABASE_SERVICE_KEY`) or issue short-lived signed upload URLs bound to the active event.

### Gap 2: Socket.IO Unauthenticated Room Eavesdropping (High)
* **Finding:** In `backend/src/index.js:103`:
  ```javascript
  io.on('connection', (socket) => {
    socket.on('join-event', (eventId) => socket.join(`event-${eventId}`));
  });
  ```
  Zero authentication or ownership validation occurs.
* **Threat:** Any connected client knowing or guessing an event ID can subscribe to `event-${eventId}` and intercept live photo uploads, guest data, and AI generation status in real time.
* **Remediation:** Authenticate the Socket.IO handshake using the JWT token or an event-scoped booth session token:
  ```javascript
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    // Verify JWT or temporary guest booth token
    next();
  });
  ```

### Gap 3: Data Model & Schema Drift (Live DB vs Backend Code)
* **Finding:** The code expects several tables and columns that are absent or named differently in the live database:

| Feature / Code File | Code Expectation | Live Supabase Database Reality | Impact |
|:---|:---|:---|:---|
| **Guest Leads** (`leads.js`) | Table `public.leads` | **Table does not exist** | Calls to `POST /api/leads` throw 500 table missing errors. |
| **Photo Templates** (`templates.js`) | Table `public.photo_templates` | **Table does not exist** | Template saving & listing completely broken. |
| **Gallery Security** (`gallery.js`) | `events.gallery_password`, `events.gallery_expires_at` | **Columns do not exist** | Password protection & expiration checks throw 500. |
| **AI Styles** (`ai.js`) | `event_styles.preview_url`<br>`event_styles.display_order`<br>`event_styles.enabled` | Actual DB columns:<br>`preview_image_url`<br>`sort_order`<br>`is_active` | Queries return `null` / `undefined` for style previews and ordering. |
| **Photo Ownership** | `photos.owner_id` (assumed per photo) | **All 141 photos have `owner_id = NULL`** | Tenancy must be derived through parent event: `photos.event_id -> events.owner_id`. |

* **Remediation:** Executed via updated `SUPABASE_DATABASE_AUDIT_AND_RLS_FIXES.sql` which adds the missing columns, creates `leads` and `photo_templates`, and bridges the `event_styles` column name drift.

---

## 3. Prioritized Action Register

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PRIORITY 0 (P0) — IMMEDIATE                     │
├────────────────────────────────────────────────────────────────────────┤
│ • Restrict GET /api/events/:id public DTO (omit PIN, secret, email).   │
│ • Apply SUPABASE_DATABASE_AUDIT_AND_RLS_FIXES.sql to Supabase.         │
│ • Secure photobooth-media storage bucket against anonymous mutations.  │
│ • Reorder express.raw() before express.json() for Stripe webhooks.     │
│ • Fix stripe initialization order in billing.js.                       │
│ • Authenticate Socket.IO join-event subscriptions.                     │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        PRIORITY 1 (P1) — SHORT TERM                    │
├────────────────────────────────────────────────────────────────────────┤
│ • Add requireAuth and tenancy ownership checks across all event CRUD.  │
│ • Connect missing API contracts: /billing/my-plan, check-limits.       │
│ • Fix reference errors: import supabase in email.js & templates.js.    │
│ • Wire planEnforcement.js limits into photo uploads and event creation.│
│ • Normalize event_styles column mapping in ai.js.                      │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        PRIORITY 2 (P2) — ARCHITECTURE                  │
├────────────────────────────────────────────────────────────────────────┤
│ • Unify fragmented subscription tables into public.user_subscriptions. │
│ • Implement IndexedDB offline capture queue for venue Wi-Fi drops.     │
│ • Implement live TV slideshow mode (/slideshow/:slug).                 │
│ • Connect TemplateDesigner to sharp image compositing pipeline.        │
│ • Replace GIF-only exports with H.264 MP4 videos for Instagram/TikTok. │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Multi-Tenant Target Data Architecture

To solve the photo ownership finding (where 100% of photos have `owner_id = NULL`), the platform should standardize on **hierarchical event-based tenancy**:

```
[auth.users] (Owner ID)
     │
     ▼ 1:Many
[events] (Stores owner_id, event details, branding, settings)
     │
     ├──► 1:Many [photos] (Ownership verified via photos.event_id -> events.owner_id)
     ├──► 1:Many [leads] (Collected guest emails & phone numbers)
     ├──► 1:Many [analytics] (Capture, share, and print metrics)
     ├──► 1:Many [event_frames] (PNG transparent overlays)
     └──► 1:Many [event_styles] (Curated AI prompt styles)
```

This guarantees that:
1. Photos never need duplicate `owner_id` columns maintained or migrated.
2. Checking `events.owner_id === req.user.id` automatically protects all photos, leads, styles, frames, and analytics associated with that event.
3. RLS queries use `EXISTS (SELECT 1 FROM events e WHERE e.id = photos.event_id AND e.owner_id = auth.uid())`.

---

## 5. Next Steps

1. **Database Step:** Run the updated **`SUPABASE_DATABASE_AUDIT_AND_RLS_FIXES.sql`** in the Supabase SQL Editor. This closes the storage exploit, hidden photos leak, missing columns, and missing tables in one transaction.
2. **Backend Step:** Begin patching the P0/P1 backend routes (`index.js`, `billing.js`, `events.js`, `photos.js`, `ai.js`).
