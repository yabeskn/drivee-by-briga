# Drifee by Briga

**Smart EV Fleet Telematics PWA** — Real-time telemetry tracking, anti-spoofing verification, eco-driving evaluation, and BrigaCoins incentives platform.

![Drifee Logo](./public/icon.svg)

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Project Structure](#project-structure)
- [Environment Configuration](#environment-configuration)
- [Database Setup & Migrations (Supabase)](#database-setup--migrations-supabase)
- [Local Development](#local-development)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [Trip Verification Pipeline (P0 API)](#trip-verification-pipeline-p0-api)
- [Production Deployment (Vercel)](#production-deployment-vercel)
- [License](#license)

---

## Overview

Drifee by Briga is a progressive web application designed for electric vehicle fleet operators and drivers. It enables high-frequency offline-first GPS/CAN telematics recording, anti-tamper photo verification, server-side physics validation, eco-driving scoring, and automated cryptographic reward distribution with BrigaCoins.

---

## Key Features

- **Offline-First Telematics**: Collects GPS and sensor points locally via IndexedDB (`dexie.js`) and auto-syncs when online.
- **Screen WakeLock**: Uses the Screen Wake Lock API to keep the HUD visible and active during vehicle operation.
- **Anti-Spoofing & Photo Verification**: Captures odometer and battery state of charge (SoC) photos with cryptographic SHA-256 trip hashing.
- **Physics Sanity Checks**: Validates physical velocity limits ($\le 160\text{ km/h}$), non-negative energy consumption ($\ge 0\text{ kWh}$), and chronological continuity.
- **BrigaCoins Rewards System**:
  - $\text{Base Reward} = \text{distance\_km} \times 10$
  - $\text{Eco Multiplier} = \frac{\text{eco\_score}}{100} \times 0.5 \times \text{Base}$
  - $\text{Streak Bonus} = +50\text{ BrigaCoins}$ on every 5th consecutive qualifying trip ($\text{eco\_score} \ge 85$).
- **Role-Based Route Protection**: Next.js middleware guards private dashboards (`/admin`, `/company`, `/rewards`, `/go`, etc.) and sensitive API endpoints (`/api/sync`, `/api/redeem`).

---

## Architecture & Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Local Storage**: IndexedDB via Dexie.js
- **Database & Auth**: Supabase PostgreSQL + Supabase Auth / NextAuth
- **Test Runner**: Vitest (unit & boundary test tiers) + Playwright (E2E browser tests)
- **Maps**: Leaflet + CARTO tiles + OSRM routing engine
- **Deployment**: Vercel

---

## Project Structure

```text
src/
├── app/
│   ├── api/
│   │   ├── auth/              # NextAuth route handler
│   │   ├── brigacoin/         # Token balance endpoints
│   │   ├── redeem/            # Reward redemption API
│   │   ├── sync/              # Offline-to-cloud sync engine
│   │   └── trips/
│   │       ├── history/       # Driver trip history
│   │       └── verify/        # P0 Trip verification endpoint
│   ├── auth/callback/         # Google OAuth PKCE callback
│   ├── admin/                 # Admin dashboard
│   ├── company/               # Fleet operator portal
│   ├── go/                    # Active driving PWA interface
│   ├── login/                 # Driver & operator sign-in
│   ├── rewards/               # Rewards catalog & redemption
│   └── layout.tsx             # Root layout with PWA manifest
├── components/
│   ├── forms/                 # Form inputs & validation
│   ├── layout/                # Shell, navigation, status bars
│   └── screens/               # LoginVehicleScreen, ActiveDrivingHUD, EndTripDashboard
├── hooks/
│   ├── useTelematics.ts       # Sensor collection & WakeLock
│   └── useSilentWatchdog.ts   # Background network & sync monitor
├── lib/
│   ├── brigacoin/             # Token balance, rewards, redemption logic
│   ├── db.ts                  # Dexie.js IndexedDB schema
│   ├── eco-score.ts           # Driving metrics & scoring engine
│   ├── supabase/              # Server & client Supabase SDK instances
│   ├── trip-hasher.ts         # SHA-256 payload integrity hashing
│   └── trip-submitter.ts      # API submission & sync orchestrator
└── middleware.ts              # Route protection middleware
```

---

## Environment Configuration

Create a `.env.local` file in the root directory by copying `.env.example`:

```bash
cp .env.example .env.local
```

### Required Environment Variables

| Variable | Description | Example / Default |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Base application URL | `http://localhost:3000` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `http://localhost:3000` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | `https://<project-id>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Public Anonymous Key | `ey...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Private Service Role Key | `ey...` |
| `NEXTAUTH_URL` | Canonical URL for NextAuth | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | Secret key for JWT signing | `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | `<id>.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | `<secret>` |
| `OSRM_URL` | Open Source Routing Machine endpoint | `https://router.project-osrm.org` |

---

## Database Setup & Migrations (Supabase)

The project utilizes Supabase PostgreSQL with Row Level Security (RLS). Migrations are located in `supabase/migrations/`:

1. `001_initial_schema.sql`: Base tables (`drivers`, `vehicles`, `trips`, `offline_queue`, `storage_buckets`).
2. `002_ecosystem_tables.sql`: Ecosystem extensions (`companies`, `rewards`, `redemptions`, `brigacoin_transactions`).
3. `003_telemetry_points_and_fixes.sql`: High-resolution `telemetry_points` table, driver streak counters, trip summary statistics, and hardened RLS rules.
4. `004_trip_lifecycle.sql`: Trip lifecycle states and index optimizations.

### Applying Migrations

Using the Supabase CLI:

```bash
# Link your Supabase project
npx supabase link --project-ref <your-project-id>

# Push migrations to the remote database
npx supabase db push
```

Alternatively, run the migrations sequentially in the Supabase Dashboard **SQL Editor**.

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Run TypeScript build verification
npx tsc --noEmit

# 3. Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the application.

---

## Testing & Quality Assurance

Drifee by Briga includes a 4-tier test architecture:

- **Tier 1 (Feature Coverage)**: Verification API, token economics, schema definitions, auth protection.
- **Tier 2 (Boundary & Stress)**: Unrealistic speeds ($> 160\text{ km/h}$), negative energy, missing metadata, streak edge cases.
- **Tier 3 (Cross-Feature Combinations)**: Token calculation interactions with driver streaks and telemetry summaries.
- **Tier 4 (Real-World Scenarios)**: Offline driving, reconnecting, batch sync, and reward redemptions.

### Running Automated Tests

```bash
# Run Vitest test suite (76 tests across 11 test suites)
npm test

# Run Vitest in watch mode
npm run test:watch

# Run Playwright end-to-end tests
npx playwright test

# Build for production (compiles all static pages and API routes)
npm run build
```

---

## Trip Verification Pipeline (P0 API)

The `POST /api/trips/verify` endpoint verifies completed trips:

1. **Payload Integrity**: Validates presence of `trip_id`, `driver_id`, `distance_km`, `start_time`, and `end_time`.
2. **Anti-Spoofing Check**: Validates photo evidence timestamps and verifies SHA-256 payload hash.
3. **Physics Sanity Check**:
   - `max_speed_kmh <= 160` and `average_speed_kmh <= 160`.
   - `energy_used_kwh >= 0`.
   - Chronological validation: `end_time > start_time`.
4. **Token Economics Calculation**:
   - Computes base reward + eco score multiplier + 5-trip streak bonus.
5. **Persistence**:
   - Updates `trips` record to `VERIFIED`.
   - Updates driver `current_streak`, `total_trips`, and `average_eco_score`.
   - Inserts audit ledger transaction into `brigacoin_transactions`.
6. **Response**: Returns HTTP 200 with verification details on success, or HTTP 400 with failure reasons on rejection.

---

## Production Deployment (Vercel)

1. **Push Code**: Push your repository to GitHub / GitLab.
2. **Import Project**: Import the repository into the [Vercel Dashboard](https://vercel.com).
3. **Configure Environment Variables**:
   - Add all variables from `.env.local` to Vercel Project Settings $\rightarrow$ **Environment Variables**.
   - Ensure `NEXT_PUBLIC_APP_URL` and `NEXTAUTH_URL` reflect your production domain (e.g., `https://drifee.briga.id`).
4. **Build Settings**:
   - Framework Preset: `Next.js`
   - Build Command: `npm run build`
   - Output Directory: `.next`
5. **Deploy**: Trigger deployment. Next.js will build all pages and API routes with zero compilation errors.

---

## License

© 2026 Drifee by Briga. PT Briga Energi Indonesia. All rights reserved.
