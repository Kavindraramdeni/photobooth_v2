# Mock Interview Script (30 Questions) + Memorize-Ready Answers

## 1) Tell me about yourself.
**Answer:** I’m a full-stack developer focused on Next.js + Node.js apps. I build fast MVPs with clean architecture, then harden for security, scalability, and UX.

## 2) Why Next.js instead of plain React?
**Answer:** Next.js gives routing, SSR/SSG, API routes, optimization, and deployment readiness out of the box.

## 3) SSR vs SSG vs CSR?
**Answer:** SSR renders per request, SSG renders at build time, CSR renders in browser after JS loads.

## 4) What is App Router in Next.js?
**Answer:** File-based routing in `app/`, with nested layouts, server components by default, and streaming support.

## 5) What does `use client` do?
**Answer:** It marks a component for client-side execution so hooks/events/browser APIs work.

## 6) Difference between `useEffect` and `useMemo`?
**Answer:** `useEffect` runs side effects; `useMemo` caches computed values.

## 7) What is state lifting?
**Answer:** Moving shared state to the nearest common parent so multiple children stay in sync.

## 8) Why keys in list rendering?
**Answer:** Keys help React track item identity and update efficiently without UI bugs.

## 9) What is middleware in Node/Express?
**Answer:** Functions in the request pipeline for auth, validation, logging, rate limiting, etc.

## 10) What is RESTful API design?
**Answer:** Resource-based endpoints with standard HTTP verbs and predictable status codes.

## 11) 400 vs 401 vs 403 vs 500?
**Answer:** 400 bad input, 401 unauthenticated, 403 unauthorized, 500 server error.

## 12) Why validate on backend if frontend already validates?
**Answer:** Frontend validation improves UX; backend validation enforces security and data integrity.

## 13) SQL vs NoSQL — when to use each?
**Answer:** SQL for relational integrity/joins; NoSQL for flexible schema and document-centric workloads.

## 14) What is database indexing?
**Answer:** Data structure that speeds lookups/sorts at the cost of write overhead and storage.

## 15) What is normalization?
**Answer:** Structuring tables to reduce duplication and improve consistency.

## 16) What is JWT?
**Answer:** Signed token carrying claims; server verifies signature/expiry for stateless auth.

## 17) Authentication vs Authorization?
**Answer:** Authentication confirms identity; authorization controls what that identity can access.

## 18) How do you secure passwords?
**Answer:** Never store plain text; hash with strong algorithms and enforce minimum password policy.

## 19) What is rate limiting and why?
**Answer:** It caps requests per client/time window to reduce abuse and brute-force attacks.

## 20) How do you handle errors in production?
**Answer:** Centralized error handling, safe user-facing messages, structured logs, and monitoring.

## 21) What is CI/CD?
**Answer:** Automated build/test/deploy pipeline for faster, safer, and repeatable releases.

## 22) How do you optimize frontend performance?
**Answer:** Code splitting, lazy loading, image optimization, memoization, and caching.

## 23) What is accessibility (a11y)?
**Answer:** Building for all users using semantic HTML, keyboard support, contrast, labels, ARIA.

## 24) How do you design scalable backend APIs?
**Answer:** Stateless services, pagination, caching, queueing for heavy jobs, and clear service boundaries.

## 25) How do WebSockets differ from HTTP?
**Answer:** HTTP is request-response; WebSocket is persistent bidirectional real-time communication.

## 26) How would you deploy a Next.js app?
**Answer:** Deploy on Vercel/Netlify, configure env vars, DB connection, domain, and CI checks.

## 27) How do you test full-stack apps?
**Answer:** Unit tests for logic, integration tests for APIs/DB flows, E2E tests for user journeys.

## 28) If API provider fails, what do you do?
**Answer:** Retry transient failures, classify errors, fallback providers, and graceful degraded mode.

## 29) If interviewer asks: “Build a new page now,” what’s your approach?
**Answer:** Clarify scope, build MVP (loading/success/error/empty), connect API, validate, then polish UX.

## 30) Why should we hire you?
**Answer:** I deliver practical, production-minded solutions quickly, with strong debugging, ownership, and clean communication.

---

## 60-Second Project Pitch (Memorize)
I built a Next.js full-stack photobooth platform with secure auth, event and style management, media workflows, and AI-assisted image generation. I focused on reliability with provider fallback strategies, robust error handling, and real-time updates via sockets. I also improved session safety and route protection with token checks and middleware. My approach is always: ship a stable MVP fast, then optimize performance, security, and user experience.

---

## Rapid-Fire One-Liners (Backup)
- **Biggest strength:** I solve real bugs fast and explain tradeoffs clearly.
- **Weakness:** I sometimes over-polish early; now I timebox MVP first.
- **Team conflict:** I align on user impact and data, then decide quickly.
- **Deadline pressure:** Prioritize must-haves, communicate risks, deliver increments.
- **Code quality:** Small PRs, clear naming, validation, logs, tests.
