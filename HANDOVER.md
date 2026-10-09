# Project Handover Document — Drifee by Briga

**Project Name:** Drifee by Briga (Smart EV Fleet Telematics Platform)  
**Target Environment:** Production PWA  
**Updated:** September 30, 2026  
**Status:** P0 milestones complete. See §6 for a truthfulness audit — several endpoints previously returned fake success and have been rewritten. Test count is **266 across 27 suites** (not 80/12).

---

## 1. Executive Summary

Drifee by Briga is a Next.js 14 progressive web application (PWA) with offline-first capabilities using Dexie.js (IndexedDB) and Supabase PostgreSQL. It tracks real-time EV telemetry, performs anti-spoofing verification on photos and timestamps, evaluates driver eco-scores, and manages cryptographic BrigaCoins token incentives.

---

## 2. Completed Milestones & Current State

### ✅ P0 — Must-Have Deliverables (100% Complete)

| Feature | Status | Verification & Evidence |
|---|:---:|---|
| **1. Backend API (`POST /api/trips/verify`)** | **COMPLETE** | Hardened endpoint in [`src/app/api/trips/verify/route.ts`](file:///c:/Users/yabes/Documents/Drive-e%20by%20Briga/src/app/api/trips/verify/route.ts). Enforces HTTP 400 on rejection, physics boundaries ($\le 160\text{ km/h}$, non-negative energy), photo freshness checks, and exact token formulas ($Base + Eco + Streak$). Verified by 14 stress tests in `challenger-m2-stress.test.ts`. |
| **2. Database & Migrations (Supabase)** | **COMPLETE** | Migrations `001`–`010` applied to authoritative Supabase database (`qgetspwlrrwofcttnfbx`); `011` holds the admin publish columns and must be applied. Verify read-only at any time with `node scripts/verify-migrations-applied.mjs`. |
| **3. Environment & Deployment Setup** | **COMPLETE** | Documented in [`README.md`](file:///c:/Users/yabes/Documents/Drive-e%20by%20Briga/README.md) and `.env.example`. Vercel deployment instructions configured. |
| **4. End-to-End Auth & Route Protection** | **COMPLETE** | Supabase Auth Google PKCE handler at [`src/app/auth/callback/route.ts`](file:///c:/Users/yabes/Documents/Drive-e%20by%20Briga/src/app/auth/callback/route.ts) and Next.js middleware at [`src/middleware.ts`](file:///c:/Users/yabes/Documents/Drive-e%20by%20Briga/src/middleware.ts) protecting dashboards (`/admin`, `/company`, `/rewards`, `/go`) and sensitive APIs (`/api/sync`, `/api/redeem`). |

---

### ✅ P1 — Quality & Testing (Completed Portions)

| Item | Status | Details |
|---|:---:|---|
| **Sync Engine (IndexedDB $\to$ Supabase)** | **COMPLETE** | Implemented in [`src/lib/sync/engine.ts`](file:///c:/Users/yabes/Documents/Drive-e%20by%20Briga/src/lib/sync/engine.ts) and [`src/app/api/sync/route.ts`](file:///c:/Users/yabes/Documents/Drive-e%20by%20Briga/src/app/api/sync/route.ts). Flushes pending offline trips when device reconnects to network. |
| **Error Tracking & Monitoring (Sentry)** | **COMPLETE** | Production-ready zero-dependency Sentry module in [`src/lib/sentry.ts`](file:///c:/Users/yabes/Documents/Drive-e%20by%20Briga/src/lib/sentry.ts) capturing client and server errors, breadcrumbs, and tags with fallback logging. Verified by unit tests. |
| **Admin Manual Verification Dashboard** | **COMPLETE** | Interactive manual review controls in [`src/app/admin/page.tsx`](file:///c:/Users/yabes/Documents/Drive-e%20by%20Briga/src/app/admin/page.tsx) with status filtering (All, Pending, Verified, Rejected), photo & telemetry evidence viewer, and [`/api/admin/trips/review`](file:///c:/Users/yabes/Documents/Drive-e%20by%20Briga/src/app/api/admin/trips/review/route.ts) endpoint. |
| **Automated CI/CD Workflows** | **COMPLETE** | GitHub Actions workflows in [`.github/workflows/`](file:///c:/Users/yabes/Documents/Drive-e%20by%20Briga/.github/workflows/) running `npm test`, typecheck (`npx tsc --noEmit`), Playwright E2E suites, and production builds on push/PR. |
| **Web Push Notifications & Offline Alerts** | **COMPLETE** | Web Notification manager in [`src/lib/notifications.ts`](file:///c:/Users/yabes/Documents/Drive-e%20by%20Briga/src/lib/notifications.ts) with `notificationclick` navigation in [`public/sw.js`](file:///c:/Users/yabes/Documents/Drive-e%20by%20Briga/public/sw.js) for reward additions and offline queue flush events. |
| **Performance & Bundle Splitting Optimization** | **COMPLETE** | Webpack `splitChunks` cacheGroups in [`next.config.js`](file:///c:/Users/yabes/Documents/Drive-e%20by%20Briga/next.config.js) separating Leaflet, Supabase, and Dexie into distinct caching layers, with production console stripping. |
| **Unit & Boundary Testing** | **COMPLETE** | 266 automated tests across 27 Vitest suites, all passing (`npm test`). |
| **E2E Test Infrastructure** | **COMPLETE** | 4-tier testing harness (Vitest) and Playwright test suite in `e2e/`. |
| **Production Build** | **COMPLETE** | `npm run build` generates 35 static and dynamic routes with zero TypeScript or linting errors. |

---

## 3. What's Next (Ongoing Operations & Future Enhancements)

1. **Production Deployment & DNS Cutover**:
   - Link production domain `drifee.briga.id` in Vercel.
   - Set up production secrets in Vercel project environment settings.
2. **Fleet Hardware Integration (CAN Bus / OBD-II)**:
   - Expand `useTelematics` hook to interface with hardware dongles via Web Bluetooth (BLE) for real-time motor temperatures and instantaneous battery degradation metrics.

---

## 4. Key Configuration & Commands

### Running Locally

```bash
# Install dependencies
npm install

# Run Vitest test suite (266 tests across 27 suites)
npm test

# Run TypeScript type check
npx tsc --noEmit

# Run Next.js production build
npm run build

# Start local development server
npm run dev
```

### Database Verification

```bash
# Read-only: confirm migrations 001-010 are applied on the live DB
node scripts/verify-migrations-applied.mjs
```

> Applying migrations requires `SUPABASE_DB_PASSWORD` plus `npm i -D pg`. Without those, paste the SQL from `supabase/migrations/` into the Supabase SQL Editor and re-run the verify script.

---

## 6. Truthfulness Audit (October 2, 2026)

An audit found endpoints that reported success without persisting anything. These were rewritten; the principles applied are: never fabricate IDs or `success: true`, distinguish **503 (not configured)** from **200 (empty)**, take identity from the verified session rather than the request body, and enforce idempotency with a DB constraint rather than app logic.

| Endpoint / module | Before | After |
|---|---|---|
| `src/lib/baileys/agent.ts` | Reported `connected` with no socket | Only reports `connected` with a real socket; adds `unavailable` status + `lastError`; `sendMessage()` refuses and does not increment `messageCount` on failure |
| `src/app/api/whatsapp/agents` (PUT) | Echoed the request back | Applies the status via `setAgentStatus()` with rollback, returns 503 + real reason on transport failure |
| `src/app/api/crm/driver` | Invented an ID, never wrote | Upserts `drivers` by email (201/200), reads real rows, 404 when absent, 503 when DB is unconfigured |
| `src/app/api/activity/log` | `console.log` only | Inserts into `activity_logs`; IP and user-agent taken from headers (not client-supplied) |
| `src/app/api/register/driver` | Invented an ID | Real `upsert` with `onConflict: 'email'`, returns the DB id |
| `src/app/api/register/vehicle` | Invented an ID | Real insert with `buildVehicleCode()` from the plate; returns `photosStored: false` + `warnings` because `JSON.stringify(File)` never carried photos |
| `src/app/special-track` | 2 hardcoded listings, fake success toast | Fetches real DB rows, real eligibility check, idempotent apply, real error/empty states |
| `src/app/api/admin/vehicles` | No admin check; returned 2 fabricated fallback vehicles and `veh_${Date.now()}` ids on insert | Requires admin; fabricated fallbacks removed — DB empty returns an empty list, insert failure returns 500 with `persisted: false` |
| `src/app/api/admin/trips/review` | **No admin check at all** — any logged-in user could mint BrigaCoin | Requires admin via `requireAdmin()`; the "simulation" branch that reported success without saving now returns 503 |

New migrations `009_driver_profile_and_activity_log.sql` and `010_special_track.sql` (both applied) back this up: 15 driver profile columns, `activity_logs` with RLS read-own-only and no client INSERT policy, and `special_track_jobs` / `special_track_applications` with a `UNIQUE (job_id, driver_id)` index.

### Known incomplete (deliberately not faked)

- The 2 Special Track listings are **seed demo data**, and their `company_id` is `null` because the `companies` table is currently empty. They are flagged `is_seed` by migration 011 so admins can tell them apart and delete them from the new admin page.
- Vehicle photo upload does not work end-to-end; it needs multipart parsing and Supabase Storage. The API reports this instead of pretending.
- `src/lib/briga/api.ts` is still a stub against a non-existent `api.briga.id`. It is not on any active path.
- Repo-wide `npx biome check` fails with 417 pre-existing errors, unrelated to this work.

---

## 8. Admin Authorization (October 2, 2026)

The repo previously had **no concept of an admin role at all** — no admin table, no role check, and `/admin` guarded only by "is logged in". `src/lib/admin-auth.ts` adds one:

- An admin is a Supabase user whose **`app_metadata.role === 'admin'`**, read from the session verified against `/auth/v1/user`. `user_metadata` is deliberately ignored because a user can edit their own.
- `requireAdmin()` returns 401 when there is no valid session and 403 when the session is valid but not an admin.
- Applied to `/api/admin/trips/review`, `/api/admin/vehicles`, and all four Special Track admin routes. The BrigaCoin `metrics` / `reconcile` routes already had their own service-token check.

To grant yourself admin, run once in the Supabase SQL Editor (replace the email):

```sql
UPDATE auth.users
   SET raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
 WHERE email = 'you@example.com';
```

### Admin Special Track publish flow

`/admin/special-track` creates, closes, reopens, and deletes job listings and reviews applications. Migration `011` adds `created_by` / `updated_at` / `closed_at` / `is_seed` on jobs and `reviewed_by` / `reviewed_at` / `review_note` on applications. `created_by` and `reviewed_by` intentionally have **no FK to `drivers`** because an admin need not have a driver row.

Deliberate limits:

- `PATCH` changes **status only**. Editing requirements or the eco threshold in place is not supported, so closed listings stay readable as an accurate archive.
- Deleting a job that already has applications is refused; close it instead. Removing it would silently discard real driver applications.
- Lowongan seed are **flagged, not deleted**, by the migration. Deleting them without consent would discard real applications.

---

## 7. Special Track (applied)

`/special-track` now reads from the database via `GET /api/special-track/jobs` and applies via `POST /api/special-track/apply`. Domain logic lives in `src/lib/special-track.ts`: eligibility (status, inclusive `min_eco_score`, vehicle category — all failing reasons are reported at once), idempotent apply, and driver resolution from the `sb-access-token` session cookie.

Two schema gotchas found here:

- `companies.id` is `VARCHAR(255)`, not UUID (from migration 002). `special_track_jobs.company_id` therefore references it as `VARCHAR(255)`; using UUID fails with `ERROR: 42804`.
- `drivers.vehicle_id` exists live but is in no migration file and has no guaranteed FK, so PostgREST cannot embed `vehicle_id (category)`. Eligibility uses two separate queries instead.

---

## 9. Biome lint cleanup (October 5, 2026)

`npx biome check src tests e2e scripts` now reports **0 errors** (warnings only).
Before cleanup `biome check src` reported 444 errors across 149 files; almost all were
formatter drift — the repo used spaces and single quotes, while `biome.json` requires
tabs and double quotes.

What changed:

- Ran Biome's safe formatter + `organizeImports` + safe lint fixes over `src`, `tests`, `e2e`, `scripts`.
- `useHookAtTopLevel` (27) split into one real bug and a batch of false positives:
  - `EndTripDashboard` called 7 `useState` hooks **after** an early `return` when `tripData` was null — a genuine Rules-of-Hooks violation that crashes on the null→data transition. Fixed by extracting the non-null body into `EndTripDashboardTrip`; the wrapper keeps the empty state so hook order is stable.
  - The rest were false positives: a local helper named `useSupabase()` was read as a React hook. Renamed to `isSupabaseConfigured()` in `brigacoin/{balance,redemption,rewards}.ts` and `hr/rental.ts`.
- `useExhaustiveDependencies` (20): mount-only fetches now use `useCallback` plus a real dependency array (`rewards`, `special-track`, `CameraCapture`, `FleetManagementTab`); `useTelematics` gained the missing `batteryCapacityKwh` / `estimatePowerKw` / `nextSoc` and lifecycle deps. All added values are stable `useCallback`s or props, so the sensor start/stop timing is unchanged.
- a11y: added `type="button"` to 84 buttons that omitted `type` (submit buttons that already declared `type="submit"` were untouched), `aria-hidden="true"` to 23 decorative SVGs, and `htmlFor`/`id` to 48 labels (2 group headings became `<span>`).
- `noUnknownAtRules` on `src/app/globals.css` is scoped off in `biome.json` because `@tailwind` is a Tailwind directive, not an unknown CSS at-rule.
- `noArrayIndexKey` keys now use stable identities (`item.employee`, `item.route`, `step.title`, `stat.label`, and the requirement/error strings).
- Added `/privacy` and `/terms` stub pages so the footer links resolve to real routes instead of the `href="#"` that Biome rejects.

Verification:

- `npx tsc --noEmit` → 0 errors
- `npm test` → 27 files / 266 tests pass
- `npm run build` → succeeds (`/privacy`, `/terms` registered)

Remaining diagnostics are **warnings only** (12 in `src`, ~54 in `tests`/`e2e`/`scripts`) and were left deliberately: `noExplicitAny` (Supabase row shapes and the Web NFC `NDEFReader` type, absent from the TS DOM lib), `noImgElement` (camera preview and captured data URLs — `next/image` is wrong for blob URLs), `noNonNullAssertion`, `noDocumentCookie` (session cookie handling), `noImportantStyles`, and `noTemplateCurlyInString` (tests that intentionally assert literal template syntax in source).

`package.json` gains `npm run lint` / `npm run lint:fix`. Biome is still **not** wired into `.github/workflows/ci.yml`; `biome check` exits 0 with warnings, so adding a step is safe but was left to the owner.

---

## 5. Directory & File Reference

- **Trip Verification API**: [`src/app/api/trips/verify/route.ts`](file:///c:/Users/yabes/Documents/Drive-e%20by%20Briga/src/app/api/trips/verify/route.ts)
- **Token Economics & Scoring**: [`src/lib/eco-score.ts`](file:///c:/Users/yabes/Documents/Drive-e%20by%20Briga/src/lib/eco-score.ts)
- **Offline Sync Engine**: [`src/lib/sync/engine.ts`](file:///c:/Users/yabes/Documents/Drive-e%20by%20Briga/src/lib/sync/engine.ts)
- **Route Middleware**: [`src/middleware.ts`](file:///c:/Users/yabes/Documents/Drive-e%20by%20Briga/src/middleware.ts)
- **Supabase Migrations**: [`supabase/migrations/`](file:///c:/Users/yabes/Documents/Drive-e%20by%20Briga/supabase/migrations/)
- **Test Suites**: [`tests/e2e/`](file:///c:/Users/yabes/Documents/Drive-e%20by%20Briga/tests/e2e/)
- **Special Track domain logic**: [`src/lib/special-track.ts`](file:///c:/Users/yabes/Documents/Drive-e%20by%20Briga/src/lib/special-track.ts)
- **Setup & Deployment Guide**: [`README.md`](file:///c:/Users/yabes/Documents/Drive-e%20by%20Briga/README.md)
