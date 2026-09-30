# Project: Drive-e by Briga Smart EV Fleet Telematics

## Architecture
- **Framework**: Next.js 14.2.35 (App Router), React 18.3.1, TypeScript 6.0.3, Tailwind CSS.
- **Backend / Database**: Supabase PostgreSQL (`drivers`, `vehicles`, `trips`, `telemetry_points`, `brigacoin_transactions`, `rewards`, `redemptions`, `companies`).
- **Authentication**: Supabase Auth (Google OAuth PKCE flow with `/auth/callback`), session persistence, Next.js `middleware.ts` for route protection.
- **Verification Engine**: Server-side POST `/api/trips/verify` validating anti-spoofing, physics plausibility, cryptographic hashes, deterministic token reward calculation, and atomic ledger state updates.
- **Testing Infrastructure**: Vitest v5 unit test suite (`npm test`) covering token calculations, physics, and verification rules; E2E testing track verifying opaque-box API and route behavior.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Database Migrations & Schemas | PostgreSQL schema for `drivers`, `vehicles`, `trips`, `telemetry_points`, `brigacoin_transactions` with foreign keys, indexes, and RLS | M1 | ORIGINAL_REQUEST §R2 |
| 2 | Model Integrity & TypeScript Types | Update `src/lib/supabase/schema.ts` to include all driver, trip, and telemetry columns | M1 | ORIGINAL_REQUEST §R2 |
| 3 | RLS Security Enforcement | Restrict `brigacoin_transactions` direct insert from clients; add missing RLS policies | M1 | Survey Finding |
| 4 | Anti-Spoofing & Photo Validation | Validate photo metadata, check photo timestamp relative to trip start (not server current time), reject manipulated timestamps | M2 | ORIGINAL_REQUEST §R1 |
| 5 | Physics Plausibility Checks | Reject speed > 160 km/h, reject negative energy (`energy_used_kwh < 0`), reject negative distance or invalid duration | M2 | ORIGINAL_REQUEST §R1 |
| 6 | Deterministic Rejection Response | Return HTTP 400 with structured failure reason on spoofing, physics, or validation failure | M2 | ORIGINAL_REQUEST §R1 |
| 7 | Cryptographic Hash Canonicalization | Align SHA-256 canonical payload between `src/lib/trip-hasher.ts` and `/api/trips/verify` | M2 | Survey Finding |
| 8 | Token Reward Calculation | Accurately compute: Base (`distance_km * 10`), Eco Multiplier (`(eco_score / 100) * 0.5 * Base`), Streak Bonus (`+50` every 5th consecutive trip with `eco_score >= 85`) | M2 | ORIGINAL_REQUEST §R1 |
| 9 | Driver Streak & Ledger Update | Server recalculates tokens, queries/updates driver `current_streak`, and records `brigacoin_transactions` entry on `VERIFIED` status | M2 | ORIGINAL_REQUEST §R1 |
| 10 | Google OAuth PKCE Route Handler | Implement `/auth/callback/route.ts` to exchange OAuth code for Supabase session | M3 | ORIGINAL_REQUEST §R3 |
| 11 | Session Persistence & Auth State | Secure session persistence using Supabase Auth sessions; remove insecure spoofable localStorage bypass | M3 | ORIGINAL_REQUEST §R3 |
| 12 | Route Protection Middleware | Implement `src/middleware.ts` to protect private views (`/admin`, `/company`, `/rewards`, `/special-track`, `/verify`, `/go`) and secure API routes | M3 | ORIGINAL_REQUEST §R3 |
| 13 | Unit Test Infrastructure | Configure `vitest.config.mts` and `"test": "vitest run"` in `package.json` | M4 | ORIGINAL_REQUEST §R4 |
| 14 | Automated Unit Test Suite | Comprehensive unit tests for token rewards, streak logic, anti-spoofing, physics checks with 100% pass rate | M4 | ORIGINAL_REQUEST §R4 |
| 15 | Environment & Setup Documentation | Document local setup, required environment variables, Supabase migrations, and Vercel configuration in README.md | M5 | ORIGINAL_REQUEST §R5 |
| 16 | E2E Testing Suite (Tiers 1-4) | Opaque-box requirement-driven test suite verifying verification API, economics, auth, and database integrity | E2E Track | ORIGINAL_REQUEST Acceptance Criteria |
| 17 | Next.js Production Build Health | Validate `npm run build` succeeds with 0 TypeScript and 0 lint errors | M6 | ORIGINAL_REQUEST Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Suite Track | Opaque-box test harness & test suite (Tiers 1-4) publishing `TEST_READY.md` | none | DONE |
| M1 | Database Migrations & Model Integrity | PostgreSQL migration for `telemetry_points`, fix `fk_hr_company`, update `schema.ts`, harden RLS | none | DONE |
| M2 | Trip Verification API & Token Economics Hardening | POST `/api/trips/verify` physics checks (<= 160 km/h, energy >= 0), HTTP 400 rejection, hash alignment, token formulas (Base, Eco, Streak), driver streak and transaction ledger updates | M1 | DONE |
| M3 | Authentication & Route Protection Audit | Google Sign-In PKCE callback, secure session handling, `src/middleware.ts` route protection | M1 | DONE |
| M4 | Unit Testing Suite & Verification Logic | Vitest config, npm test script, unit tests for token economics, physics, and verification rules | M2 | DONE |
| M5 | Setup Documentation & Environment Config | Comprehensive README.md, .env.example, Supabase & Vercel deployment docs | M1, M2, M3, M4 | DONE |
| M6 | Final Milestone & Build Validation | Pass 100% E2E tests, verify `npm test` and `npm run build` pass with 0 errors | M1, M2, M3, M4, M5, E2E | DONE |

## Interface Contracts
### Client ↔ Verification API (`POST /api/trips/verify`)
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```typescript
  interface TripVerificationPayload {
    trip_id: string;
    driver_id: string;
    vehicle_id: string;
    start_time: string; // ISO-8601
    end_time: string; // ISO-8601
    distance_km: number;
    eco_score: number; // 0 - 100
    energy_used_kwh: number;
    telemetry_summary: {
      average_speed_kmh: number;
      max_speed_kmh: number;
      harsh_accelerations: number;
      harsh_brakings: number;
      idle_duration_seconds: number;
    };
    score_breakdown: {
      smooth_driving: number;
      speed_compliance: number;
      energy_efficiency: number;
      regenerative_braking: number;
    };
    start_photo_evidence?: {
      odometer_km: number;
      battery_percent: number;
      captured_at: number; // unix ms
    };
    end_photo_evidence?: {
      odometer_km: number;
      battery_percent: number;
      captured_at: number; // unix ms
    };
    client_nonce?: string;
    hashed_at?: string;
    trip_hash: string;
  }
  ```
- **Response Format (Success - HTTP 200)**:
  ```json
  {
    "verification_status": "VERIFIED",
    "trip_id": "...",
    "tokens_earned": 125,
    "breakdown": {
      "base_reward": 100,
      "eco_multiplier_reward": 25,
      "streak_bonus": 0
    },
    "current_streak": 3,
    "verified_at": "..."
  }
  ```
- **Response Format (Rejection - HTTP 400)**:
  ```json
  {
    "verification_status": "REJECTED",
    "trip_id": "...",
    "reason": "Physics check failed: speed exceeds maximum threshold of 160 km/h",
    "details": { ... }
  }
  ```

## Database Schema Contract
- `drivers`: `id (UUID PK)`, `email`, `full_name`, `phone`, `current_streak (INT DEFAULT 0)`, `total_trips (INT DEFAULT 0)`, `average_eco_score (NUMERIC)`, `role (TEXT)`.
- `trips`: `id (UUID PK)`, `driver_id (UUID FK)`, `vehicle_id (UUID FK)`, `distance_km`, `eco_score`, `energy_used_kwh`, `verification_status`, `tokens_awarded`.
- `telemetry_points`: `id (UUID PK)`, `trip_id (UUID FK -> trips.id ON DELETE CASCADE)`, `timestamp (TIMESTAMPTZ)`, `latitude`, `longitude`, `speed_kmh`, `battery_soc`, `power_kw`, `accelerometer_x`, `accelerometer_y`, `accelerometer_z`.
- `brigacoin_transactions`: `id (UUID PK)`, `driver_id (UUID FK)`, `trip_id (UUID FK NULLABLE)`, `amount (NUMERIC)`, `transaction_type ('trip_reward' | 'redemption' | 'bonus' | 'penalty')`, `created_at`.

## Code Layout
- `src/app/api/trips/verify/route.ts`: Verification API route handler.
- `src/lib/eco-score.ts`: Eco score calculation, continuous token formula, streak logic.
- `src/lib/trip-hasher.ts`: Canonical trip hashing utility.
- `src/lib/trip-submitter.ts`: Client-side trip submission and evidence packaging.
- `src/lib/supabase/schema.ts`: Supabase database TypeScript definitions.
- `supabase/migrations/`: SQL migration files (`001_initial_schema.sql`, `002_ecosystem_tables.sql`, `003_telemetry_points_and_fixes.sql`).
- `src/middleware.ts`: Next.js session validation and route protection.
- `src/app/auth/callback/route.ts`: Supabase PKCE OAuth callback handler.
- `vitest.config.ts`: Vitest test configuration.
- `src/__tests__/`: Unit test suites for token calculation and verification logic.
- `README.md`: Environment setup, migrations, local dev, and Vercel documentation.
