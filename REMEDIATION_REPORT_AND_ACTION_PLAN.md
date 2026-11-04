# SnapBooth AI (v2.0) — Complete Audit, Bug Catalog & Remediation Action Plan

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
* **Location:** `backend/src/routes/events.js:22` (`GET /api/events`)
* **Root Cause:** The route performs an unrestricted query `supabase.from('events').select('*')` without verifying `requireAuth` or filtering by `owner_id`. It includes `settings.operatorPin` in the returned JSON.
* **Impact:** Any unauthenticated caller can discover all customer events, venues, dates, client names/emails, and cleartext operator PINs.
* **Remediation:**
  1. Add `requireAuth` middleware.
  2. Scope query to `eq('owner_id', req.user.id)`.
  3. Strip `operatorPin` from standard event responses, or hash it with bcrypt/argon2.
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
* **Location:** `backend/src/routes/events.js:73, 152, 175` (`POST`, `PUT /:id`, `DELETE /:id`)
* **Root Cause:**
  * `POST /`: Does not verify identity or assign `owner_id`.
  * `PUT /:id`: Does not authenticate, does not verify ownership, and directly does `.update({ ...updates })` with the entire unvalidated `req.body`.
  * `DELETE /:id`: Does not authenticate or verify ownership.
* **Impact:** Any user can reassign ownership of events, disable events, alter webhook endpoints, inject arbitrary branding, or archive competitor events.
* **Remediation:**
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
* **Location:** `frontend/src/middleware.ts:11-16`
* **Root Cause:**
```typescript
const isOperatorMode = searchParams.get('operator') === 'true';
const isEventPage = /^\/admin\/events\/[^/]+$/.test(pathname);
if (isOperatorMode && isEventPage) {
  return NextResponse.next();
}
```
The middleware permits any unauthenticated user to access `/admin/events/[id]?operator=true` under the assumption that the client checks a PIN. However, `frontend/src/app/admin/events/[id]/page.tsx` does **not** enforce PIN verification.
* **Impact:** Anyone with an event URL can append `?operator=true` and immediately access the full management panel to download photos, modify branding, and view visitor analytics.
* **Remediation:** Remove the query parameter bypass from `frontend/src/middleware.ts`. For legitimate operators at a venue, implement a dedicated login/PIN exchange endpoint (`POST /api/auth/operator-login`) that validates the PIN server-side and issues a scoped JWT cookie (`sb_operator_token`).

---

### 1.4 Unprotected Photo Uploads, Deletions, and Moderation
* **Severity:** Critical
* **Location:** `backend/src/routes/photos.js:71, 212, 280, 333, 400, 486`
* **Root Cause:**
  * Photo upload, GIF creation, strip creation, and burst accept arbitrary `eventId` without verifying whether the request originates from an active booth or authorized client.
  * `DELETE /:photoId` requires `requireAuth` but never verifies whether `req.user.id` owns the event associated with that photo.
  * `GET /event/:eventId` honors `include_hidden=true` without verifying owner authorization.
* **Impact:** Any authenticated user can delete any other user's event photos; attackers can flood storage quotas or bypass moderation filters.
* **Remediation:**
  1. Booth writes (`/upload`, `/gif`, `/strip`, `/burst`) must require an Event Booth Session Token or validate event status.
  2. Photo deletions and moderation must verify owner tenancy:
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
* **Location:** `backend/src/routes/ai.js:204, 346, 371`
* **Root Cause:** `POST /api/ai/generate` and `/api/ai/filter` do not verify authentication or plan limits. They accept `customPrompt` from the client.
* **Impact:** Attackers can make unlimited Cloudflare Workers AI or HuggingFace API calls at the owner's expense and pass arbitrary prompts to bypass content safety filters.
* **Remediation:**
  1. Enforce active booth token and check plan quota (`checkPhotoLimit`).
  2. Disallow arbitrary `customPrompt` from public booth clients; only permit predefined `styleKey` styles or custom styles created by the event owner in `event_styles`.

---

### 1.6 Public Share Endpoints & Stripe Client Initialization Bug
* **Severity:** Critical
* **Location:** `backend/src/routes/share.js:100, 199` and `backend/src/routes/billing.js:71, 80`
* **Root Cause:**
  * `POST /api/share/email` and `POST /api/share/sms` are publicly accessible without rate limiting per IP or recipient.
  * In `billing.js:71`, `await stripe.customers.create(...)` is executed before `const stripe = getStripe()` is initialized at line 80.
* **Impact:** 
  * Email/SMS spammers can use the booth backend as an open relay to blast arbitrary addresses via Resend/Twilio.
  * Checkout fails with `ReferenceError: Cannot access 'stripe' before initialization`.
* **Remediation:**
```javascript
// backend/src/routes/billing.js
router.post('/checkout', requireAuth, async (req, res) => {
  try {
    const stripe = getStripe(); // Initialize FIRST
    const { planKey, isAnnual = false } = req.body;
    const operatorEmail = req.user.email;
    // ...
```
And apply rate limiters in `share.js`:
```javascript
const shareLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many shares sent. Please wait a minute.' },
});
router.post('/email', shareLimiter, ...);
router.post('/sms', shareLimiter, ...);
```

---

### 1.7 Stripe Webhook Middleware Ordering Bug
* **Severity:** High
* **Location:** `backend/src/index.js:34-36`
* **Root Cause:**
```javascript
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
```
`express.json()` processes and buffers the incoming JSON payload before the route-level `express.raw()` executes.
* **Impact:** `stripe.webhooks.constructEvent()` throws because `req.body` is an Object instead of a Buffer/string. Subscriptions are never updated.
* **Remediation:** Mount `express.raw()` before `express.json()`:
```javascript
// backend/src/index.js
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
```

---

### 1.8 Gallery Password Query Leakage & Incomplete Authorization
* **Severity:** High
* **Location:** `backend/src/routes/gallery.js:10, 31` & `backend/src/routes/photos.js`
* **Root Cause:**
  * Password is accepted via URL query parameter `?password=...`, exposing it in proxy logs, browser histories, and referrer headers.
  * Direct photo retrieval endpoints (`/api/photos/:photoId` and R2 public URLs) do not verify whether the photo belongs to a password-protected or expired gallery.
* **Remediation:**
  1. Accept passwords only via `POST /api/gallery/:slug/auth` and issue a signed, HTTP-only session cookie.
  2. Filter out `is_hidden = true` photos uniformly across all public queries.

---

## 2. Medium Functional Bugs & Runtime Crashes

| Item | File & Line | Cause | Fix |
| :--- | :--- | :--- | :--- |
| **2.1 Missing Supabase Client** | `backend/src/routes/email.js:15` | Calls `supabase.from('photos')` without requiring `../services/database`. | Add `const supabase = require('../services/database');`. |
| **2.2 Missing Supabase Client & Bad Routes** | `backend/src/routes/backgrounds.js:11` & `templates.js:11` | Calls `supabase` without requiring it; routes declare `/backgrounds` instead of `/event/:eventId`. | Require `supabase` and rename route paths to accept `:eventId`. |
| **2.3 Missing `nanoid` Package** | `backend/src/routes/photos.js:599` | Calls `require('nanoid').nanoid(6)` but `nanoid` is not listed in `backend/package.json`. | Replace with crypto-based helper or `uuidv4().slice(0, 8)`. |
| **2.4 Missing Import & Argument Error in Frame Deletion** | `backend/src/routes/events.js:527, 674` | Calls `deleteFromStorage(frame.url)` without importing `deleteFromStorage`, and passes a full URL instead of a storage key. | Import `deleteFromStorage` from `../services/storage`, extract key from URL, and remove the duplicated route definition at line 663. |
| **2.5 Email Confirmation Flow Misconfiguration** | `backend/src/routes/auth.js:40` | `admin.createUser({ email_confirm: false })` does not send an email confirmation. | Use `supabaseAnon.auth.signUp({ email, password, options: { data: { name } } })` which naturally triggers Supabase's confirmation email flow. |
| **2.6 Missing Plan Enforcement Application** | `backend/src/middleware/planEnforcement.js` | `checkEventLimit`, `requireFeature`, and `checkPhotoLimit` are written but never mounted to `/api/events`, `/api/photos`, or `/api/ai`. | Mount `checkEventLimit` on `POST /api/events` and `checkPhotoLimit` on photo/media creation. |
| **2.7 ZIP Download Header Omission** | `frontend/src/lib/api.ts:87` | Calls `fetch('/api/photos/event/${eventId}/zip')` without attaching `Authorization: Bearer <token>`. | Add `headers: { Authorization: `Bearer ${token}` }`. |

---

## 3. Broken Frontend-to-Backend API Contracts

| Contract Call | Frontend Source | Backend Status | Remediation |
| :--- | :--- | :--- | :--- |
| `GET /api/billing/my-plan` | `frontend/src/lib/api.ts:312`<br>`frontend/src/app/account/page.tsx:59` | **Missing** | Implement `GET /api/billing/my-plan` using `getUserPlanFeatures(req.user.id)`. |
| `GET /api/billing/check-limits` | `frontend/src/lib/api.ts:317` | **Missing** | Implement `GET /api/billing/check-limits` returning event and photo usage counts. |
| `POST /api/events/:id/gallery-auth` | `frontend/src/lib/api.ts:179`<br>`frontend/src/app/gallery/[slug]/page.tsx:128` | **Missing** | Implement in `backend/src/routes/events.js` to verify `galleryPassword`. |
| `POST /api/events/:id/webhook-test` | `frontend/src/lib/api.ts:167`<br>`frontend/src/app/admin/events/[id]/page.tsx:19` | **Missing** | Implement in `events.js` to dispatch a test payload to the configured webhook URL. |
| `POST /api/email/photo` | `frontend/src/lib/api.ts:329` | Backend has `/api/share/email` and `/api/email/send-email` | Normalize frontend to call `POST /api/share/email`. |
| `Photo Events Data Mapping` | `frontend/src/app/p/[code]/page.tsx:76` | Reads `photo.event` while PostgREST returns `photo.events` | Support `const ev = photo?.events || photo?.event;`. |

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

### Current Schema Conflict
* `billing.js` writes to `operators` (`email`, `stripe_customer_id`, `plan`, `subscription_status`).
* `planEnforcement.js` reads from `user_subscriptions` (`user_id`, `plan`, `status`).
* Result: A user who buys a plan in Stripe never gets their quotas updated in `user_subscriptions`.

### Consolidated Target DDL
```sql
-- Consolidate into user_subscriptions
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT UNIQUE,
    plan TEXT NOT NULL DEFAULT 'free', -- 'free', 'starter', 'pro', 'business'
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'trialing', 'past_due', 'canceled'
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_subscription UNIQUE (user_id)
);

-- Ensure events table strictly enforces owner_id
ALTER TABLE public.events 
    ALTER COLUMN owner_id SET NOT NULL,
    ADD CONSTRAINT fk_events_owner FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

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
   * Remove duplicate `DELETE /api/events/:id/frames/:frameId` at line 663 of `events.js`.
   * Standardize the maximum JSON body limit (50MB is unnecessarily high for JSON endpoints; keep 50MB for Multer uploads, 2MB for JSON).

---

## 7. Step-by-Step Remediation Sequence

1. **Step 1: Emergency Server Fixes**
   - In `backend/src/index.js`, move `express.raw()` before `express.json()`.
   - In `backend/src/routes/billing.js`, initialize `const stripe = getStripe()` at the top of route handlers.
   - In `backend/src/routes/email.js`, `backgrounds.js`, and `templates.js`, import `supabase`.
2. **Step 2: Security & IDOR Lockdown**
   - Apply `requireAuth` to `GET /api/events`, `POST /api/events`, `PUT /api/events/:id`, and `DELETE /api/events/:id`.
   - Store `owner_id: req.user.id` on creation and enforce `eq('owner_id', req.user.id)` on updates and deletes.
   - Enforce tenancy verification on `DELETE /api/photos/:photoId` and `GET /api/leads/event/:eventId`.
   - Remove the `?operator=true` bypass in `frontend/src/middleware.ts`.
3. **Step 3: Contract Alignment**
   - Implement `/api/billing/my-plan` and `/api/billing/check-limits`.
   - Implement `/api/events/:id/gallery-auth` and `/api/events/:id/webhook-test`.
   - Fix `frontend/src/lib/api.ts` ZIP download headers and `p/[code]/page.tsx` photo event mapping.
4. **Step 4: Billing Schema Unification**
   - Update Stripe webhook in `billing.js` to upsert into `user_subscriptions` using the customer's Supabase `user_id`.
   - Verify plan limits across photo uploads and event creation.
