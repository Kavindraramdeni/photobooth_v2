# SnapBooth AI — Master System Register & Production Roadmap

> [!IMPORTANT]
> **Definitive Master Reference**: This document consolidates all historical audits, security remediations, live database configurations, completed features, and the upcoming development backlog into a single source of truth for the entire SnapBooth AI platform.

---

## 1. System Status & Verification Overview

| Metric | Status | Details |
|:---|:---|:---|
| **Git Remote** | `origin/main` | [`https://github.com/Kavindraramdeni/photobooth_v2.git`](https://github.com/Kavindraramdeni/photobooth_v2.git) |
| **Live Database** | `hlhxbhraxtonjdieorvb` | Supabase PostgreSQL 17 (Sydney, ap-southeast-2) |
| **Row Level Security** | Active (10/10 tables) | 23 scoped policies (21 public tables + 2 storage) |
| **Automated Tests** | **57/57 Passed (100%)** | `npm test --prefix backend` across 7 test suites |
| **Frontend Build** | **Compiled Clean (0 errors)** | `npm run build --prefix frontend` (14 dynamic routes) |
| **Email Architecture** | **Unified Resend API** | Native `fetch` with graceful console fallback |

---

## 2. Complete Checklist of Everything Fixed, Improved & Added

### A. Critical Security Vulnerabilities Remediated (SEC-01 – SEC-08)
- [x] **SEC-01: Event Exposure & Cleartext Operator PIN Leak** (`backend/src/routes/events.js`)
  - Added `requireAuth` to `GET /api/events` scoping results to `owner_id = req.user.id`.
  - Sanitized public DTOs in `GET /api/events/:id` to strip `operatorPin`, `webhookSecret`, and `client_email` for unauthenticated callers.
- [x] **SEC-02: Unauthenticated Event Mutation** (`backend/src/routes/events.js`)
  - Secured `POST`, `PUT`, `DELETE` behind authentication and `owner_id = req.user.id`.
  - Whitelisted updatable fields to prevent arbitrary request body injection.
- [x] **SEC-03: Kiosk Admin Auth Bypass** (`frontend/src/middleware.ts`)
  - Removed insecure `?operator=true` query parameter bypass that allowed unauthenticated access to admin routes.
- [x] **SEC-04: Unauthorized Photo Deletion & Moderation** (`backend/src/routes/photos.js`)
  - Enforced hierarchical tenancy (`events.owner_id === req.user.id`) on photo deletion and moderation toggles.
- [x] **SEC-05: AI Route Quota & Authentication Protection** (`backend/src/routes/ai.js`)
  - Added `requireAuth` to event-style management routes (`/event-styles`, `/upload-preview`).
- [x] **SEC-06: Stripe Customer Creation ReferenceError** (`backend/src/routes/billing.js`)
  - Moved `const stripe = getStripe()` initialization before customer lookups/creation, eliminating runtime crashes.
- [x] **SEC-07: Stripe Webhook Body Parser Ordering** (`backend/src/index.js`)
  - Mounted `express.raw({ type: 'application/json' })` for `/api/billing/webhook` strictly before `express.json()`.
- [x] **SEC-08: Socket.IO Unauthenticated Room Eavesdropping (Gap 2)** (`backend/src/index.js`)
  - Built connection handshake authentication (`io.use`) validating Supabase JWTs, operator tokens, or booth session tokens.
  - Restricted `socket.join('event-${id}')` to authorized owners, operators, and booth sessions.

### B. Functional Runtime Bug Fixes (BUG-01 – BUG-07)
- [x] **BUG-01: Auth Missing Database Require** (`backend/src/routes/auth.js`)
  - Added missing database service imports and unified error handling.
- [x] **BUG-02: Email Route ReferenceError** (`backend/src/routes/email.js`)
  - Added missing `const supabase = require('../services/database')` import.
- [x] **BUG-03: Backgrounds & Templates Route Parameter Alignment** (`backend/src/routes/backgrounds.js`, `templates.js`)
  - Added missing `supabase` import and aligned route paths to support both `/:eventId` and `/event/:eventId`.
- [x] **BUG-04: Missing `nanoid` Runtime Dependency** (`backend/src/routes/photos.js`)
  - Replaced undeclared `nanoid` in burst mode with cryptographic short code generator `generateUniqueShortCode(supabase)`.
- [x] **BUG-05: Duplicate Storage & Route Handlers** (`backend/src/routes/events.js`)
  - Imported `deleteFromStorage` and removed duplicate `DELETE /:id/frames/:frameId` handler.
- [x] **BUG-06: Plan Enforcement Attachment** (`backend/src/middleware/planEnforcement.js`)
  - Connected plan limit verification middleware to event and photo creation routes.
- [x] **BUG-07: Download Photos ZIP 401 Authorization** (`frontend/src/lib/api.ts`)
  - Attached `Authorization: Bearer <token>` to `downloadPhotosZip` requests.

### C. Broken API Contract Alignment
- [x] **Contract 1: `GET /api/billing/my-plan`**: Implemented returning current plan limits and billing cycle details.
- [x] **Contract 2: `GET /api/billing/check-limits`**: Implemented active event/photo counts vs tier limits.
- [x] **Contract 3: `POST /api/events/:id/gallery-auth`**: Implemented password verification against event settings and database column.
- [x] **Contract 4: `POST /api/events/:id/webhook-test`**: Implemented webhook ping dispatcher with owner verification.
- [x] **Contract 5: `POST /api/email/photo` Alias**: Aligned frontend email photo requests with backend handler.
- [x] **Contract 6: Schema Field Mapping in `/p/[code]`**: Aligned `photo?.events || photo?.event` branding resolution.

### D. Supabase Live Database Migrations & Hardening (`hlhxbhraxtonjdieorvb`)
- [x] **Reconciled Missing Columns**: Added `user_id` and `email` to `public.subscriptions`, and `gallery_password` and `gallery_expires_at` to `public.events`.
- [x] **Created Missing Tables**: Created `public.leads`, `public.photo_templates`, and `public.print_jobs` with foreign key cascades.
- [x] **Harmonized Aliased Columns**: Synced `event_styles` columns (`preview_url` $\leftrightarrow$ `preview_image_url`, `display_order` $\leftrightarrow$ `sort_order`, `enabled` $\leftrightarrow$ `is_active`).
- [x] **Row Level Security (RLS)**: Enabled RLS across all 10 public tables (`events`, `photos`, `analytics`, `operators`, `user_subscriptions`, `subscriptions`, `event_styles`, `event_frames`, `leads`, `photo_templates`, `print_jobs`).
- [x] **Storage Bucket Security (`photobooth-media`)**: Removed dangerous anonymous upload/update policies; scoped writes strictly to authenticated backends.
- [x] **Operator PIN Generator Trigger**: Deployed `trg_sanitize_operator_pin` to auto-assign secure random 4-digit PINs on event creation.

### E. Phase 1 Essential Improvements Implemented & Verified
- [x] **Feature 1: Secure Event Access**: Ownership and role access checks enforced across all event CRUD routes.
- [x] **Feature 2: Secure Photo Uploads**: Gated media uploads behind `requireBoothSession` validating `x-booth-session` headers bound to event IDs.
- [x] **Feature 3: Photo Privacy Control**: Filtered `is_hidden` photos returning HTTP 404 to public callers while allowing owner access. Blocked email/SMS sharing of hidden photos.
- [x] **Feature 4: Scoped Operator PIN Authentication**: Implemented `POST /api/auth/operator-login` and `POST /api/events/:id/operator-login` issuing 12-hour scoped operator tokens with constant-time PIN comparison and rate limiting.
- [x] **Feature 5: Event Staff Management**: Implemented staff role boundaries and `/api/events/:id/staff` endpoints.
- [x] **Feature 6: Secure Live Gallery & Expiration**: Unified gallery password gates in `/gallery/[slug]` and enforced expiration checks via `gallery_expires_at`.
- [x] **Feature 7: Upload Deduplication & Idempotency**: Integrated `clientCaptureId` / `clientPhotoId` checks returning existing photo records on retries without duplicate rows.
- [x] **Feature 8: Kiosk Offline Capture & Background Auto-Sync**:
  - Built `frontend/src/lib/offlineQueue.ts` using client-side IndexedDB (`SnapBoothOfflineDB`).
  - Added offline fallback in `CountdownScreen.tsx` preserving captures locally with instant preview via object URLs.
  - Implemented `useOfflineSync.ts` hook and `BoothMain.tsx` background sync on `window.online` with retry backoff and queue badges.

### F. Mobile-Friendly Rich Responsive Layouts
- [x] **Kiosk Touch UI**: Redesigned `ShareScreen`, `PreviewScreen`, `CountdownScreen`, and `AIStudioScreen` with fluid flex/grid layouts and `min-h-[44px]` touch targets.
- [x] **Guest QR Photo Page (`/p/[code]`)**: Optimized mobile photo presentation, WebShare API integration, direct download actions, and dynamic back-navigation.
- [x] **Public Event Gallery (`/gallery/[slug]`)**: Responsive masonry grid, mobile lightbox modal, and password authentication prompt.
- [x] **Admin Event Management (`/admin/events/[id]`)**: Horizontal scrolling tab bar and responsive metric cards for smartphone and tablet viewports.
- [x] **Local SVG QR Generation**: Replaced third-party external QR image endpoints with local `QRCodeSVG` rendering for offline reliability.

### G. Phase 2 Features Added
- [x] **Feature 13: Live Event Slideshow (`/slideshow/[id]`)**: Full-screen projector view with real-time Socket.IO photo updates, floating gallery QR corner, and keyboard navigation (`Space`, `F`, `Q`, `Arrows`).
- [x] **Features 10 & 11: Print Manager & Queue Engine (`backend/src/routes/print.js`)**: Server-side print queue endpoints (`POST /api/print/queue`, `GET /api/print/queue/:eventId`, `PATCH /api/print/queue/:jobId`) backed by `public.print_jobs`.
- [x] **Feature 9: Multi-Booth Fleet Monitoring**: Kiosk heartbeat telemetry (`POST /api/events/:id/kiosks/heartbeat`) and admin fleet monitoring (`GET /api/events/:id/kiosks`).

### H. Unified Email Architecture
- [x] **Resend API Integration**: Unified all photo and batch emails under Resend (`https://api.resend.com/emails`) using `RESEND_API_KEY`.
- [x] **Zero SDK Lock-In**: Eliminated hard dependency on `@sendgrid/mail`.
- [x] **Graceful Fallback Mode**: When keys are missing in local dev, logs `[EMAIL_FALLBACK]` to console and succeeds gracefully with HTTP 200.

---

## 3. Comprehensive Remaining Backlog (What Needs to Be Added / Improved Next)

### Priority 1: Hardware & Venue Bridges (Phase 2 Remaining)
- [ ] **Thermal / Dye-Sub Local Printer Bridge**:
  - Local desktop companion agent (Electron or lightweight Node service) listening to `print-job-created` via Socket.IO.
  - Direct CUPS / Windows Spooler driver bridge for instant unattended printing to DNP, Citizen, or HiTi printers.
- [ ] **Interactive Print Template Canvas Designer**:
  - Visual drag-and-drop web designer for 2x6 photo strips and 4x6 landscape/portrait postcard layouts.
  - Dynamic text placeholder variables (`{{event_name}}`, `{{date}}`, `{{session_id}}`).

### Priority 2: Guest Experience & WhatsApp Delivery (Phase 3)
- [ ] **WhatsApp Cloud API Integration**:
  - Direct automated photo delivery to guest phone numbers via Meta WhatsApp Business Cloud API.
  - Automated WhatsApp message template with photo media attachment and guest short link.
- [ ] **Themed AI Experience Booth Expansion**:
  - Custom LoRA model style selector for venue themes (Cyberpunk, 1920s Gatsby, Anime, Pop Art).
  - Background removal via WebAssembly / serverless edge models before style composition.
- [ ] **Live Slideshow Audience Reactions**:
  - Real-time guest emoji reactions (❤️, 🎉, 🔥) floating across the live slideshow screen when viewing from phones.

### Priority 3: Commercial & Multi-Tenant Platform Scaling
- [ ] **White-Label Agency Platform & Custom CNAME Provisioning**:
  - Dynamic CNAME routing allowing agencies to host galleries on `photos.agencyname.com`.
  - Automated Cloudflare SSL for custom agency domains.
- [ ] **Sponsor Branding & Monetization Modules**:
  - Sponsor logo watermark rotation, pre-roll/post-roll interstitial screens in kiosk flow, and lead export webhooks.
- [ ] **Real-Time Fleet Operations Dashboard**:
  - Dedicated admin screen visualizing multi-booth kiosks on a venue map with battery, camera FPS, and printer paper roll gauges.

---

## 4. Environment Configuration Reference

To enable full production delivery, configure these variables in `backend/.env` or your hosting platform (Render/Vercel):

```bash
# ─── Supabase (Live Database & Storage) ──────────────────────────────────────
SUPABASE_URL=https://hlhxbhraxtonjdieorvb.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_KEY=eyJhbGciOi...

# ─── Resend API (Primary Email Provider) ─────────────────────────────────────
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=photos@yourdomain.com   # (Defaults to onboarding@resend.dev)

# ─── Stripe Billing ──────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ─── Application URLs ────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://your-frontend-domain.com
NEXT_PUBLIC_API_URL=https://your-backend-domain.com
NEXT_PUBLIC_SOCKET_URL=https://your-backend-domain.com
```

---

## 5. Verification Commands

Run these anytime to verify system health:

```bash
# Run all 57 backend security, privacy, and E2E integration tests
npm test --prefix backend

# Run frontend production build & TypeScript typecheck
npm run build --prefix frontend

# Verify database RLS policies
# Run in Supabase SQL Editor:
SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
SELECT tablename, policyname, cmd, roles FROM pg_policies WHERE schemaname = 'public';
```
