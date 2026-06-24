# Photobooth_v2 Code Walkthrough Plan (Interview)

Use this sequence to explain architecture quickly and confidently.

## 1) Start with the system entry points (2-3 minutes)

1. `frontend/src/app/page.tsx`  
   - Shows the top-level product entry and public navigation flow.
2. `frontend/src/app/booth/page.tsx` and `frontend/src/app/booth/BoothPageClient.tsx`  
   - Establishes how the live booth experience is mounted.
3. `backend/src/index.js`  
   - Shows API server bootstrapping, middleware, and route registration.

Why first: interviewers want a "map" before details.

## 2) Explain core user journey: capture -> process -> share (5-8 minutes)

1. `frontend/src/components/booth/BoothMain.tsx`  
   - Main booth state machine and screen orchestration.
2. `frontend/src/components/booth/CountdownScreen.tsx` + `PreviewScreen.tsx` + `ShareScreen.tsx`  
   - Capture UX, confirmation UX, and sharing UX.
3. `frontend/src/lib/api.ts`  
   - Client/server contract for uploads, events, and sharing.
4. `backend/src/routes/photos.js`  
   - Upload and photo lifecycle endpoints.
5. `backend/src/services/imageProcessor.js`, `gif.js`, `storage.js`  
   - Media processing, transformations, and persistence.
6. `backend/src/routes/share.js` + `backend/src/services/sharing.js`  
   - Public sharing links and downstream delivery.

Why second: this is the product’s most important flow.

## 3) Cover event/business logic (4-6 minutes)

1. `backend/src/routes/events.js`  
   - Event configuration APIs.
2. `frontend/src/app/admin/events/[id]/page.tsx`  
   - Event management UI surface.
3. `frontend/src/components/admin/EventPageTabs.tsx`, `FramesManager.tsx`, `OrientationSettings.tsx`  
   - Practical controls operators use at events.
4. `backend/src/middleware/planEnforcement.js` + `backend/src/routes/billing.js`  
   - Subscription boundaries and monetization concerns.

Why: demonstrates product understanding beyond UI.

## 4) Authentication, security, and access control (3-4 minutes)

1. `frontend/src/contexts/AuthContext.tsx` + `frontend/src/middleware.ts`  
   - Session handling and client-side route gating.
2. `backend/src/routes/auth.js` + `backend/src/middleware/requireAuth.js`  
   - Token/session verification and protected API routes.

Why: interviewers often ask how sensitive event data is protected.

## 5) Analytics and operational visibility (2-4 minutes)

1. `backend/src/routes/analytics.js` + `frontend/src/components/admin/AnalyticsDashboard.tsx`  
   - KPIs and event performance reporting.
2. `frontend/src/components/admin/LiveDashboard.tsx`  
   - Real-time operational monitoring use case.

Why: shows production-readiness and feedback loops.

## 6) Highlight notable advanced features (optional deep-dive)

1. `backend/src/routes/ai.js` + `backend/src/services/ai.js`  
   - AI-enhanced workflows.
2. `frontend/src/components/booth/AIStudioScreen.tsx` + `GreenScreenModal.tsx`  
   - Frontend UX for AI/background effects.
3. `backend/src/routes/leads.js`  
   - Lead capture and marketing integrations.

Use if asked: "What was the most technically interesting part?"

## 7) Close with architecture summary (60 seconds)

Suggested close:
- **Frontend**: Next.js app-router app with dedicated booth/admin/public surfaces.  
- **Backend**: Express-style route modules with service layer separation.  
- **Data flow**: capture media -> process assets -> store -> share -> analyze.  
- **Business controls**: auth + plan enforcement + billing integrated into route access.

## Interview delivery tips

- Keep the first pass high-level and time-boxed (10-15 minutes total).
- Open only one "representative" file per concern unless asked to dive deeper.
- For each file, explain:
  1. its responsibility,
  2. one key design decision,
  3. one tradeoff or future improvement.
- If interrupted, jump directly to the relevant section above.
