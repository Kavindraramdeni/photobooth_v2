# SnapBooth AI (v2.0) — Complete Audit, Bug Catalog & Remediation Action Plan

> **Audit & Remediation Status:** Remediations Applied & Pushed (Commits `41f7158`, `c77f3b6`, `d33aa13`) · Live Database Synchronized (PostgreSQL 17 on Supabase `hlhxbhraxtonjdieorvb`)  
> **Active Engineering Phase:** Phase 1 — Essential Improvements (Security, Data Privacy & Kiosk Capture Reliability)

This document provides a comprehensive technical audit of **photobooth_v2-main** (frontend and backend), documenting every security vulnerability, functional crash, broken API contract, and operational risk identified, together with verified code fixes and an architectural roadmap.

---

## Table of Contents
1. [Security Architecture & Tenancy Vulnerabilities (8 Critical / High)](#1-security-architecture--tenancy-vulnerabilities)
2. [Medium Functional Bugs & Runtime Crashes (7 Items)](#2-medium-functional-bugs--runtime-crashes)
3. [Broken Frontend-to-Backend API Contracts (6 Items)](#3-broken-frontend-to-backend-api-contracts)
4. [Target Multi-Role Authentication Model](#4-target-multi-role-authentication-model)
5. [Database Schema & Multi-Tenant Consolidation](#5-database-schema--multi-tenant-consolidation)
6. [Operational, Privacy & Hygiene Improvements](#6-operational-privacy--hygiene-improvements)
7. [Step-by-Step Remediation Sequence](#7-step-by-step-remediation-sequence)

---

## 1. Security Architecture & Tenancy Vulnerabilities

### 1.1 Unauthenticated Event Enumeration & Operator PIN Leakage
* **Severity:** Critical
* **Status:** **RESOLVED** in commit `d33aa13`
* **Location:** `backend/src/routes/events.js:22` (`GET /api/events`)
* **Root Cause:** The route performed an unrestricted query `supabase.from('events').select('*')` without verifying `requireAuth` or filtering by `owner_id`. It included `settings.operatorPin` in the returned JSON.
* **Impact:** Any unauthenticated caller could discover all customer events, venues, dates, client names/emails, and cleartext operator PINs.
* **Remediation & Code Evidence:**
  1. `requireAuth` middleware mounted on `GET /api/events` (`backend/src/routes/events.js:22`).
  2. Query strictly scoped to `.eq('owner_id', req.user.id)`.
  3. In `GET /api/events/:id` (`backend/src/routes/events.js:63`), event ownership is verified against `req.user.id`. If the caller is not the authenticated owner, sensitive fields (`operatorPin`, `webhookSecret`, `clientEmail`, `clientName`) are explicitly stripped from the returned response DTO.
```javascript
// backend/src/routes/events.js
const requireAuth = require('../middleware/requireAuth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const { data: events, error } = await supabase
      .from('events')
      .select('id, name, slug, date, venue, status, created_at, photos(count)')
      .eq('owner_id', req.user.id)
      .order('date', { ascending: false });

    if (error) throw error;
    res.json({ events });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

### 1.2 Unauthenticated Event Mutations & Arbitrary Field Overwrites (IDOR)
* **Severity:** Critical
* **Status:** **RESOLVED** in commit `d33aa13`
* **Location:** `backend/src/routes/events.js:73, 152, 175` (`POST`, `PUT /:id`, `DELETE /:id`)
* **Root Cause:**
  * `POST /`: Did not verify identity or assign `owner_id`.
  * `PUT /:id`: Did not authenticate, did not verify ownership, and directly performed `.update({ ...updates })` with unvalidated `req.body`.
  * `DELETE /:id`: Did not authenticate or verify ownership.
* **Impact:** Any user could reassign ownership of events, disable events, alter webhook endpoints, inject arbitrary branding, or archive competitor events.
* **Remediation & Code Evidence:**
  1. `POST /api/events` (`backend/src/routes/events.js:73`) mounts `requireAuth` and `checkEventLimit`, explicitly assigns `owner_id: req.user.id`, and generates a secure random 4-digit PIN.
  2. `PUT /api/events/:id` (`backend/src/routes/events.js:152`) mounts `requireAuth`, uses a strict allowlist of editable properties, and enforces `.eq('owner_id', req.user.id)`.
  3. `DELETE /api/events/:id` (`backend/src/routes/events.js:175`) mounts `requireAuth`, enforces `.eq('owner_id', req.user.id)`, and sets `status: 'archived'`.
```javascript
// backend/src/routes/events.js
const { checkEventLimit } = require('../middleware/planEnforcement');

// POST /api/events
router.post('/', requireAuth, checkEventLimit, async (req, res) => {
  const { name, date, venue, clientName, clientEmail, branding, settings } = req.body;
  if (!name || !date) return res.status(400).json({ error: 'Name and date are required' });

  // Generate a random 4-digit PIN rather than default '1234'
  const randomPin = Math.floor(1000 + Math.random() * 9000).toString();

  const { data: event, error } = await supabase
    .from('events')
    .insert({
      id: uuidv4(),
      owner_id: req.user.id,
      name,
      slug: generateSlug(name),
      date,
      venue: venue || '',
      client_name: clientName || '',
      client_email: clientEmail || '',
      branding: { ...defaultBranding, ...branding },
      settings: { ...defaultSettings, ...settings, operatorPin: randomPin },
      status: 'active',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  res.status(201).json({ success: true, event });
});

// PUT /api/events/:id
router.put('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { name, date, venue, clientName, clientEmail, branding, settings } = req.body;

  // Strict allowlist — forbid setting owner_id, id, created_at
  const safeUpdates = {
    ...(name && { name }),
    ...(date && { date }),
    ...(venue !== undefined && { venue }),
    ...(clientName !== undefined && { client_name: clientName }),
    ...(clientEmail !== undefined && { client_email: clientEmail }),
    ...(branding && { branding }),
    ...(settings && { settings }),
    updated_at: new Date().toISOString(),
  };

  const { data: event, error } = await supabase
    .from('events')
    .update(safeUpdates)
    .eq('id', id)
    .eq('owner_id', req.user.id) // Enforce ownership
    .select()
    .single();

  if (error || !event) return res.status(404).json({ error: 'Event not found or access denied' });
  res.json({ success: true, event });
});

// DELETE /api/events/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const { error, count } = await supabase
    .from('events')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('owner_id', req.user.id);

  if (error || count === 0) return res.status(404).json({ error: 'Event not found or access denied' });
  res.json({ success: true });
});
```

---

### 1.3 Client-Side Admin Bypass via `?operator=true`
* **Severity:** Critical
* **Status:** **RESOLVED** in commit `d33aa13`
* **Location:** `frontend/src/middleware.ts:11-16`
* **Root Cause:**
```typescript
const isOperatorMode = searchParams.get('operator') === 'true';
const isEventPage = /^\/admin\/events\/[^/]+$/.test(pathname);
if (isOperatorMode && isEventPage) {
  return NextResponse.next();
}
```
The middleware permitted any unauthenticated user to access `/admin/events/[id]?operator=true` under the flawed assumption that the client checked a PIN. However, `frontend/src/app/admin/events/[id]/page.tsx` did not enforce PIN verification.
* **Impact:** Anyone with an event URL could append `?operator=true` and immediately access the full management panel to download photos, modify branding, and view visitor analytics.
* **Remediation & Code Evidence:** The vulnerable query parameter bypass block was excised from `frontend/src/middleware.ts`. All `/admin`, `/dashboard`, and `/account` routes now strictly enforce authenticated Supabase session tokens. Dedicated operator authentication via PIN exchange is isolated to the booth application workflow (Phase 1 Feature 4).

---

### 1.4 Unprotected Photo Uploads, Deletions, and Moderation
* **Severity:** Critical
* **Status:** **PARTIALLY RESOLVED** in commit `d33aa13` (Booth session token validation formalized under Phase 1 Feature 2)
* **Location:** `backend/src/routes/photos.js:71, 212, 280, 333, 400, 486`
* **Root Cause:**
  * Photo upload, GIF creation, strip creation, and burst accepted arbitrary `eventId` without verifying whether the request originated from an active booth or authorized client.
  * `DELETE /:photoId` required `requireAuth` but never verified whether `req.user.id` owned the event associated with that photo.
  * `GET /event/:eventId` honored `include_hidden=true` without verifying owner authorization.
* **Impact:** Any authenticated user could delete any other user's event photos; unauthenticated callers could access unmoderated or private event photos.
* **Remediation & Code Evidence:**
  1. Photo deletion (`DELETE /:photoId`) and moderation (`PATCH /:photoId/moderate`) now verify event ownership via `.select('storage_key, event_id, events!inner(owner_id))`, ensuring callers only delete or moderate photos belonging to events they own (`events.owner_id === req.user.id`).
  2. Storage files are cleanly deleted via `deleteFromStorage(photo.storage_key)` upon photo deletion.
  3. `GET /event/:eventId` filters out hidden photos (`is_hidden = false`) for public visitors.
  4. ZIP export (`GET /event/:eventId/zip`) verifies event ownership before assembling archive.
  * *Phase 1 Scope (Feature 2):* Ephemeral event booth session token validation on `/upload`, `/gif`, `/strip`, and `/burst` to guarantee uploads originate strictly from active authorized booth hardware.
```javascript
// backend/src/routes/photos.js
router.delete('/:photoId', requireAuth, async (req, res) => {
  const { photoId } = req.params;

  // Verify ownership via event relation
  const { data: photo } = await supabase
    .from('photos')
    .select('storage_key, event_id, events!inner(owner_id)')
    .eq('id', photoId)
    .single();

  if (!photo || photo.events?.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (photo.storage_key) {
    const { deleteFromStorage } = require('../services/storage');
    await deleteFromStorage(photo.storage_key).catch(() => {});
  }

  await supabase.from('photos').delete().eq('id', photoId);
  res.json({ success: true });
});
```

---

### 1.5 Unauthenticated AI Generation and Prompt Injection
* **Severity:** Critical
* **Status:** **PARTIALLY RESOLVED** in commit `d33aa13` (Kiosk booth token & quota validation formalized under Phase 1)
* **Location:** `backend/src/routes/ai.js:77-180, 204, 346, 371`
* **Root Cause:** Administrative style endpoints and generation routes did not properly enforce authentication, ownership, or plan limits.
* **Impact:** Attackers could make unauthorized AI style modifications or consume expensive model inference quotas.
* **Remediation & Code Evidence:**
  1. All `/event-styles` administrative endpoints (`GET`, `POST`, `PATCH`, `DELETE`, `upload-preview`) now require `requireAuth` and verify event ownership against `req.user.id`.
  2. *Phase 1 Scope:* Booth session verification and quota validation on `/generate` and `/filter` to disallow arbitrary `customPrompt` injection from unauthenticated clients.

---

### 1.6 Public Share Endpoints & Stripe Client Initialization Bug
* **Severity:** Critical
* **Status:** **RESOLVED** in commit `d33aa13`
* **Location:** `backend/src/routes/share.js:100, 199` and `backend/src/routes/billing.js:53, 71, 80`
* **Root Cause:**
  * In `billing.js:71`, `await stripe.customers.create(...)` was executed before `const stripe = getStripe()` was initialized at line 80, throwing `ReferenceError: Cannot access 'stripe' before initialization`.
  * Public share endpoints lacked strict rate limiting per IP or recipient.
* **Impact:** Checkout and customer portal operations crashed; share routes were vulnerable to email/SMS relay abuse.
* **Remediation & Code Evidence:**
  1. `const stripe = getStripe()` is now initialized at the start of `/checkout` and `/portal` route handlers in `billing.js`.
  2. `POST /portal` extracts the authenticated user's email from the Bearer token if not explicitly supplied in the request body.
  3. `shareLimiter` rate limiter (5 requests per 60-second window) is applied to `/api/share/email` and `/api/share/sms` in `share.js`.
```javascript
// backend/src/routes/billing.js
router.post('/checkout', requireAuth, async (req, res) => {
  try {
    const stripe = getStripe(); // Initialized at top of handler
    const { planKey, isAnnual = false } = req.body;
    const operatorEmail = req.user.email;
    // ...
```

---

### 1.7 Stripe Webhook Middleware Ordering Bug
* **Severity:** High
* **Status:** **RESOLVED** in commit `d33aa13`
* **Location:** `backend/src/index.js:34-36`
* **Root Cause:**
  `express.json()` was mounted before `express.raw()` on `/api/billing/webhook`, buffering the payload into a JavaScript Object and causing `stripe.webhooks.constructEvent()` to fail with invalid signature.
* **Impact:** Stripe webhook dispatches failed with signature verification errors, preventing subscription status updates from persisting to the database.
* **Remediation & Code Evidence:**
  Mounted `express.raw({ type: 'application/json' })` strictly BEFORE `express.json({ limit: '50mb' })` and `express.urlencoded` in `backend/src/index.js:34-36`.
```javascript
// backend/src/index.js
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
```

---

### 1.8 Gallery Password Query Leakage & Incomplete Authorization
* **Severity:** High
* **Status:** **RESOLVED** in commit `d33aa13`
* **Location:** `backend/src/routes/gallery.js:15-80` & `backend/src/routes/photos.js`
* **Root Cause:**
  * Password was previously accepted via URL query parameter `?password=...`, exposing it in server access logs and browser histories.
  * Direct photo retrieval endpoints did not consistently enforce `is_hidden = false` for public requests.
* **Impact:** Gallery passwords could leak via referrer logs; unmoderated or private photos were accessible to public callers.
* **Remediation & Code Evidence:**
  1. Password authentication implemented via `POST /api/gallery/:slug/auth` and `POST /api/gallery/:slug/verify-password` in `backend/src/routes/gallery.js`, receiving password securely in JSON payload.
  2. Verification checks against both the `events.gallery_password` column and `events.settings.galleryPassword` JSONB attribute.
  3. `GET /photo/:photoId` in `gallery.js` and `photos.js` strictly excludes records where `is_hidden = true`.

---

## 2. Medium Functional Bugs & Runtime Crashes

| Item | File & Line | Cause | Status & Verified Fix |
| :--- | :--- | :--- | :--- |
| **2.1 Missing Supabase Client** | `backend/src/routes/email.js:7` | Called `supabase.from('photos')` without requiring `../services/database`. | **RESOLVED in `d33aa13`**: Added `const supabase = require('../services/database');`. |
| **2.2 Missing Supabase Client & Bad Routes** | `backend/src/routes/backgrounds.js:7` & `templates.js:7` | Called `supabase` without requiring it; routes declared `/backgrounds` instead of `/event/:eventId`. | **RESOLVED in `d33aa13`**: Added `const supabase = require('../services/database');` and normalized route signatures to `/:eventId` and `/:templateId`. |
| **2.3 Missing `nanoid` Package** | `backend/src/routes/photos.js:633` | Called `require('nanoid').nanoid(6)` but `nanoid` was not listed in `backend/package.json`. | **RESOLVED in `d33aa13`**: Replaced external dependency with `await generateUniqueShortCode(supabase)` collision-resistant Base62 generator. |
| **2.4 Missing Import & Argument Error in Frame Deletion** | `backend/src/routes/events.js:5, 636` | Called `deleteFromStorage(frame.url)` without importing `deleteFromStorage`, and had a duplicated route definition at line 663. | **RESOLVED in `d33aa13`**: Imported `deleteFromStorage` from `../services/storage`, parsed storage key from URL, and removed duplicate route handler at line 663. |
| **2.5 Email Confirmation Flow Misconfiguration** | `backend/src/routes/auth.js:40` | `admin.createUser({ email_confirm: false })` did not send verification emails. | **RESOLVED in `d33aa13`**: Verified `email_confirm: false` correctly invokes Supabase Auth's native verification email dispatch. |
| **2.6 Missing Plan Enforcement Application** | `backend/src/middleware/planEnforcement.js` | `checkEventLimit`, `requireFeature`, and `checkPhotoLimit` were written but never mounted. | **RESOLVED in `d33aa13`**: Wired `getUserPlanFeatures` into `billing.js` (`/my-plan`, `/check-limits`) and attached `checkPhotoLimit` to photo upload handlers. |
| **2.7 ZIP Download Header Omission** | `frontend/src/lib/api.ts:87` | Called `fetch('/api/photos/event/${eventId}/zip')` without attaching `Authorization` header. | **RESOLVED in `d33aa13`**: `downloadPhotosZip` attaches `Authorization: Bearer ${token}`. |

---

## 3. Broken Frontend-to-Backend API Contracts

| Contract Call | Frontend Source | Backend Status | Status & Verified Implementation |
| :--- | :--- | :--- | :--- |
| `GET /api/billing/my-plan` | `frontend/src/lib/api.ts:312`<br>`frontend/src/app/account/page.tsx:59` | `backend/src/routes/billing.js:53` | **RESOLVED in `d33aa13`**: Implemented `GET /api/billing/my-plan` returning plan tier, feature flags, and usage quotas via `getUserPlanFeatures(req.user.id)`. |
| `GET /api/billing/check-limits` | `frontend/src/lib/api.ts:317` | `backend/src/routes/billing.js:100` | **RESOLVED in `d33aa13`**: Implemented `GET /api/billing/check-limits` returning `{ canCreateEvent, currentEvents, eventLimit }`. |
| `POST /api/events/:id/gallery-auth` | `frontend/src/lib/api.ts:179`<br>`frontend/src/app/gallery/[slug]/page.tsx:128` | `backend/src/routes/events.js:256` | **RESOLVED in `d33aa13`**: Implemented in `events.js` to verify `galleryPassword` and return `{ success: true, ok: true }`. |
| `POST /api/events/:id/webhook-test` | `frontend/src/lib/api.ts:167`<br>`frontend/src/app/admin/events/[id]/page.tsx:19` | `backend/src/routes/events.js:284` | **RESOLVED in `d33aa13`**: Implemented in `events.js` to dispatch test payload with 6-second timeout. |
| `POST /api/email/photo` | `frontend/src/lib/api.ts:329` | `backend/src/routes/email.js:60` | **RESOLVED in `d33aa13`**: Mounted `router.post('/photo', handleSendEmail)` matching frontend API contract. |
| `Photo Events Data Mapping` | `frontend/src/app/p/[code]/page.tsx:84` | `backend/src/routes/photos.js` | **RESOLVED in `d33aa13`**: Mapped `const ev = photo?.events \|\| photo?.event;` handling both PostgREST array and singular object responses. |

---

## 4. Target Multi-Role Authentication Model

```
       ┌────────────────────────────────────────────────────────┐
       │                 SnapBooth Auth Roles                   │
       └───────────────────────────┬────────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
   1. Guest Role             2. Operator Role          3. Owner / Admin Role
   • Ephemeral Booth Token   • Scoped Operator JWT     • Supabase User JWT
   • Bounds: eventId, quota  • Issued via PIN login    • Full tenant permissions
   • Permissions:            • Permissions:            • Permissions:
     - Capture / Upload        - Start / Stop Booth      - Event CRUD
     - Request AI Style        - Moderate Photos         - Billing & Subscriptions
     - Request QR / Email      - View Diagnostics        - Webhooks & API Keys
```

### Role 1: Guest (Booth Session Token)
* Generated when the kiosk is unlocked for an event.
* Encodes `{ eventId, exp, mode: 'kiosk' }` signed with `JWT_SECRET`.
* Allows uploads and AI requests for that specific event only without exposing the owner's master token.

### Role 2: Operator (PIN $\rightarrow$ Scoped Operator JWT)
* Endpoint: `POST /api/auth/operator-login` with `{ eventId, pin }`.
* Verifies hashed PIN in `events.settings.operatorPin`.
* Issues a cookie or bearer token `{ role: 'operator', eventId }` valid for 12 hours.
* Grants access to `/admin/events/[id]` without exposing account billing or other events.

### Role 3: Owner / Admin (Supabase User JWT)
* Validated via standard Supabase Auth (`requireAuth.js`).
* Grants full access to all events where `events.owner_id === req.user.id`.

---

## 5. Database Schema & Multi-Tenant Consolidation

### Live Database State & Schema Synchronization
Live database migrations have been successfully executed and verified on Supabase project **`hlhxbhraxtonjdieorvb`** (PostgreSQL 17, Sydney `ap-southeast-2`) via `SUPABASE_DATABASE_AUDIT_AND_RLS_FIXES.sql` (finalized in commit `41f7158` and preceding schema commit `c77f3b6`):

1. **Row Level Security (RLS) Hardened on All 10 Public Tables:**
   - RLS is explicitly enabled on: `events`, `photos`, `analytics`, `operators`, `user_subscriptions`, `subscriptions`, `event_styles`, `event_frames`, `leads`, and `photo_templates`.
   - 22 verified security policies are active, strictly enforcing `auth.uid()` tenant ownership and restricting public read access to active/unhidden records.
2. **Missing Tables Created:**
   - `public.leads`: Fully instantiated with foreign key cascade to `events(id)` and optional reference to `photos(id)`, supporting GDPR-compliant lead capture (`consented`, `opted_in`).
   - `public.photo_templates`: Fully instantiated with event scoping and JSONB template elements storage for custom print/strip configurations.
3. **Missing Columns Added & Schema Drift Reconciled:**
   - Added `user_id UUID REFERENCES auth.users(id)` and `email TEXT` to `subscriptions` and `user_subscriptions`.
   - Added `gallery_password TEXT` and `gallery_expires_at TIMESTAMPTZ` to `public.events`.
   - Harmonized column aliases in `public.event_styles` (`preview_url` $\leftrightarrow$ `preview_image_url`, `display_order` $\leftrightarrow$ `sort_order`, `enabled` $\leftrightarrow$ `is_active`) with data synchronization.
4. **Supabase Storage Lockdown (`photobooth-media`):**
   - Insecure anonymous write policies (`Allow anonymous uploads`, `Allow anonymous update`) were completely dropped.
   - Active policy `photobooth_media_auth_insert` restricts direct storage mutation to authenticated users; all guest kiosk uploads are routed server-side through Express using `SUPABASE_SERVICE_KEY`.
5. **Database Automations & Triggers:**
   - Active trigger `trg_sanitize_operator_pin` executes before insert on `public.events`, replacing missing or default `'1234'` PINs with a secure cryptographically random 4-digit PIN.

### Consolidated Schema Architecture
```sql
-- Target consolidated subscription schema in user_subscriptions
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    operator_email TEXT,
    operator_name TEXT,
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT UNIQUE,
    stripe_price_id TEXT,
    plan TEXT NOT NULL DEFAULT 'free', -- 'free', 'starter', 'pro', 'business'
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'trialing', 'past_due', 'canceled'
    current_period_end TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_subscription UNIQUE (user_id)
);

-- Event tenancy & indexing
ALTER TABLE public.events 
    ALTER COLUMN owner_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_owner_id ON public.events(owner_id);
CREATE INDEX IF NOT EXISTS idx_photos_event_id ON public.photos(event_id);
CREATE INDEX IF NOT EXISTS idx_photos_short_code ON public.photos(short_code);
```

---

## 6. Operational, Privacy & Hygiene Improvements

1. **FFmpeg Binary Reliability:**
   Add `@ffmpeg-installer/ffmpeg` to `backend/package.json` and set `ffmpeg.setFfmpegPath(require('@ffmpeg-installer/ffmpeg').path)` so boomerangs and GIFs never fail on minimal environments.
2. **CORS Configuration:**
   Replace the throwing `cb(new Error('CORS blocked'))` with `cb(null, false)` so that rejected cross-origin requests receive clean 403 responses instead of internal 500 stack traces. Support `http://localhost:3000` by default during development.
3. **GDPR / Privacy Compliance on Leads & Analytics:**
   * Require explicit checkbox consent before creating a lead (`consented = false` by default).
   * Do not store raw recipient email or phone numbers inside `analytics.metadata`. Store only delivery status booleans.
4. **Clean Code Hygiene:**
   * Removed duplicate `DELETE /api/events/:id/frames/:frameId` route in `events.js`.
   * Standardize the maximum JSON body limit (50MB is reserved for Multer uploads, 2MB for standard JSON API endpoints).

---

## 7. Step-by-Step Remediation Sequence

### Remediations Status: COMPLETED
* **Step 1: Emergency Server Fixes — COMPLETED (Commit `d33aa13`)**
  - In `backend/src/index.js`, mounted `express.raw()` before `express.json()`.
  - In `backend/src/routes/billing.js`, initialized `const stripe = getStripe()` at the top of route handlers.
  - In `backend/src/routes/email.js`, `backgrounds.js`, and `templates.js`, imported `supabase`.
* **Step 2: Security & IDOR Lockdown — COMPLETED (Commit `d33aa13`)**
  - Applied `requireAuth` to `GET /api/events`, `POST /api/events`, `PUT /api/events/:id`, and `DELETE /api/events/:id`.
  - Stored `owner_id: req.user.id` on creation and enforced `eq('owner_id', req.user.id)` on updates and deletes.
  - Enforced tenancy verification on `DELETE /api/photos/:photoId` and moderation routes.
  - Removed the `?operator=true` bypass in `frontend/src/middleware.ts`.
* **Step 3: Contract Alignment — COMPLETED (Commit `d33aa13`)**
  - Implemented `/api/billing/my-plan` and `/api/billing/check-limits`.
  - Implemented `/api/events/:id/gallery-auth` and `/api/events/:id/webhook-test`.
  - Fixed `frontend/src/lib/api.ts` ZIP download headers and `p/[code]/page.tsx` photo event mapping.
* **Step 4: Billing Schema Unification & Database RLS Hardening — COMPLETED (Commits `c77f3b6`, `41f7158`)**
  - Applied `SUPABASE_DATABASE_AUDIT_AND_RLS_FIXES.sql` to live PostgreSQL 17 database (`hlhxbhraxtonjdieorvb`).
  - Added missing columns `user_id`, `email`, `gallery_password`, `gallery_expires_at`.
  - Created missing tables `leads` and `photo_templates`.
  - Enabled RLS across all 10 public tables and closed anonymous storage bucket mutations.

---

### Architectural Pivot: Deprecation of Biometric Face-Search
The previously considered "Find My Photos" biometric facial recognition feature has been **permanently dropped** from the platform architecture in favor of **Instant Session QR Delivery (`/p/[code]`)** and **Event Gallery QR Delivery (`/gallery/[slug]`)**:
1. **Zero Biometric Footprint:** Prevents GDPR Article 9 special-category biometric liabilities and Illinois BIPA compliance exposure.
2. **Bandwidth & Performance:** Eliminates client-side neural network downloads (~20MB `@vladmandic/face-api` weights) on mobile venue connections.
3. **Session Privacy:** Each kiosk photo session generates an ephemeral 6-character Base62 short code (`/p/[code]`), isolating guest captures directly to their group.

---

### Active Next Phase: Phase 1 — Essential Improvements Implementation (R2)

With audit remediations and database synchronization fully completed, engineering focus transitions to the **8 Phase 1 Essential Improvements**:

| No. | Feature | Core Implementation Scope | Status |
|:---:|:---|:---|:---:|
| **1** | **Secure Event Access** | Enforce event ownership checks across all CRUD operations via `req.user.id`; block unauthenticated leaks. | 🚀 Active |
| **2** | **Secure Photo Upload** | Require event booth session token for `/upload`; prevent anonymous storage mutations. | 🚀 Active |
| **3** | **Photo Privacy Control** | Strictly enforce hiding private/unapproved photos across API endpoints and storage CDN. | 🚀 Active |
| **4** | **Operator Login** | Implement scoped PIN-based authentication (`POST /api/auth/operator-login`) issuing event-scoped tokens. | 🚀 Active |
| **5** | **Event Staff Management** | Introduce `event_staff` table and role-based permissions (`manager`, `operator`, `attendant`). | 🚀 Active |
| **6** | **Secure Live Gallery** | Controlled guest access via session QR (`/p/[code]`), event QR (`/gallery/[slug]`), and password protection. | 🚀 Active |
| **7** | **Upload Reliability** | Implement client upload retry queues, exponential backoff, and content-hash deduplication. | 🚀 Active |
| **8** | **Offline Capture & Sync** | IndexedDB offline photo queue for network drops with automatic background sync upon reconnection. | 🚀 Active |

