# Live Supabase Database Audit & RLS Security Report

**Target Project:** `hlhxbhraxtonjdieorvb` (PostgreSQL 17, ap-southeast-2 Sydney)  
**Status:** Active · Healthy  
**Public Tables:** 8 tables | RLS Active: 7/8 | Recorded Migrations: 0

---

## 1. Executive Summary of Live Findings

A direct inspection of the Supabase PostgreSQL database revealed that while `owner_id` relationships are properly established across core tables (`events`, `photos`), the database suffers from critical Row Level Security (RLS) misconfigurations, policy collisions, and table redundancies.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Existing Tables & RLS Status                         │
├────────────────────┬───────────┬───────────────────────────────────────┤
│ Table              │ RLS State │ Access Policy Status                  │
├────────────────────┼───────────┼───────────────────────────────────────┤
│ events             │ ENABLED   │ Duplicate permissive public policies  │
│ photos             │ ENABLED   │ Permissive SELECT leaks hidden photos │
│ analytics          │ ENABLED   │ NO POLICIES (Client queries blocked)  │
│ operators          │ ENABLED   │ NO POLICIES (Client queries blocked)  │
│ user_subscriptions │ ENABLED   │ NO POLICIES (Client queries blocked)  │
│ subscriptions      │ DISABLED  │ CRITICAL: Exposed to public read/edit │
│ event_styles       │ ENABLED   │ Public read + Owner manage            │
│ event_frames       │ ENABLED   │ NO POLICIES (Client queries blocked)  │
└────────────────────┴───────────┴───────────────────────────────────────┘
```

---

## 2. In-Depth Analysis of Critical Security Findings

### Finding 1: `public.subscriptions` Table Unprotected (Critical)
* **Status:** RLS is completely `OFF` on `public.subscriptions`.
* **Vulnerability:** Any client possessing the `anon_key` (which is public in the frontend bundle) can perform `SELECT`, `INSERT`, `UPDATE`, or `DELETE` on the `subscriptions` table via the Supabase REST endpoint (`/rest/v1/subscriptions`).
* **Exploitation:** Malicious actors can elevate their tier to "business", view Stripe customer IDs, or delete other users' subscription states.
* **Remediation:** 
  ```sql
  ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
  ```
  Followed by owner-only read policies (`user_id = auth.uid()`).

---

### Finding 2: Permissive OR Leakage of Hidden Photos (High)
* **Mechanics of PostgreSQL RLS:** When multiple `PERMISSIVE` policies exist for the same command (`SELECT`), PostgreSQL combines them using **`OR`**, not `AND`.
* **The Vulnerability:**
  If Policy A allows owners to view hidden photos, but Policy B is an overly broad public policy allowing `SELECT` on `public.photos` without an explicit `is_hidden = false` filter, **Policy B overrides Policy A**.
* **Impact:** Guests or competitors browsing the public gallery or calling the API can view photos that booth operators intentionally moderated or hidden (e.g. inappropriate guest behavior or unflattering retakes).
* **Remediation:**
  Drop the duplicate/overly broad policies and define strict mutually exclusive policies:
  ```sql
  -- Public can ONLY read visible photos:
  CREATE POLICY "photos_public_read_visible" ON public.photos
  FOR SELECT TO public USING (is_hidden = false OR is_hidden IS NULL);

  -- Only event owner can read hidden photos:
  CREATE POLICY "photos_owner_select_all" ON public.photos
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = photos.event_id AND e.owner_id = auth.uid()));
  ```

---

### Finding 3: Tables with RLS Enabled but Zero Policies (Dead Tables for Client SDK)
* **Affected Tables:** `analytics`, `event_frames`, `operators`, `user_subscriptions`.
* **The Problem:** In Supabase, enabling RLS on a table without defining any policies results in a **default deny** for all roles (`anon` and `authenticated`). Only the `service_role` key can access rows.
* **Impact:** If the frontend attempts to read user subscriptions via `supabaseAnon`, or query `event_frames`, the API returns an empty array `[]` with no error, causing features in the admin dashboard to appear broken.
* **Remediation:** Script `SUPABASE_DATABASE_AUDIT_AND_RLS_FIXES.sql` adds owner-scoped policies (`auth.uid()`) to allow authenticated users to view their subscriptions, frames, and analytics.

---

### Finding 4: Insecure Default Operator PIN (`1234`)
* **The Problem:** In the database seed and default event JSON, `settings.operatorPin` is set to `"1234"`.
* **Impact:** Because many operators do not change the default settings, anyone entering `1234` can unlock operator controls on live kiosks.
* **Remediation:** A PostgreSQL database trigger `trg_sanitize_operator_pin` has been authored in `SUPABASE_DATABASE_AUDIT_AND_RLS_FIXES.sql` to intercept new event inserts and automatically generate a cryptographically random 4-digit PIN whenever `1234` or a null PIN is detected.

---

## 3. Subscription Table Redundancy (3-Way Split)

Your database currently has **three** distinct tables related to subscriptions and operators:
1. `public.operators`: (Uses `email`, `stripe_customer_id`, `plan`, `subscription_status`).
2. `public.user_subscriptions`: (Uses `user_id`, `plan`, `status`).
3. `public.subscriptions`: (Legacy table, RLS was disabled).

### Recommended Consolidation Plan:
* **Standardize on `public.user_subscriptions`** as the single source of truth because it links directly to `auth.users.id` (UUID foreign key).
* In the Stripe webhook (`billing.js`), upsert into `user_subscriptions` using `user_id`.
* Deprecate and drop `subscriptions` and `operators` after data backfill.

---

## 4. How to Apply the SQL Script in Supabase

1. Open your **Supabase Dashboard** for project `hlhxbhraxtonjdieorvb`.
2. Navigate to the **SQL Editor** tab on the left navigation bar.
3. Open a new query window.
4. Copy and paste the entire contents of **[`SUPABASE_DATABASE_AUDIT_AND_RLS_FIXES.sql`](file:///c:/Users/Kavin/antigravity/photobooth_v2-main/SUPABASE_DATABASE_AUDIT_AND_RLS_FIXES.sql)**.
5. Click **Run** (or `Ctrl+Enter`).
6. Verify under **Authentication $\rightarrow$ Policies** that all 8 tables have green shields with active policies.
