# Test Infrastructure Specification — E2E Testing Track

**Project**: Drive-e by Briga Smart EV Fleet Telematics  
**Track**: End-to-End (E2E) & Integration Testing  
**Status**: ACTIVE & TEST READY  
**Primary Test Runner**: Vitest v5.0.2 on Node v25.9.0  

---

## 1. Overview & Testing Philosophy

The E2E Testing Track provides an opaque-box, requirement-driven verification harness derived strictly from `ORIGINAL_REQUEST.md` and `PROJECT.md`. It evaluates system behavior against the authoritative specifications without facade tests or coupling to unhardened legacy implementations.

### 4-Tier Test Architecture
1. **Tier 1: Feature Coverage** (>= 5 tests per feature): Validates primary happy paths and expected error contracts for each core capability.
2. **Tier 2: Boundary & Corner Cases** (>= 5 tests per feature): Rigorous boundary-value analysis (BVA), extreme values, and adversarial stress inputs.
3. **Tier 3: Cross-Feature Combinations**: Pairwise interactions across Auth, Verification API, Token Economics, Database Schema, and Ledger Updates.
4. **Tier 4: Real-World Application Scenarios** (>= 5 scenarios): Multi-step end-to-end workflows modeling authentic fleet operations, milestone streaks, adversarial tampering, and route security.

---

## 2. Directory Layout

All E2E test suites and harness modules are isolated under `tests/e2e/`:

```
c:\Users\yabes\Documents\Drive-e by Briga\
├── vitest.config.mts                     # Vitest configuration (path aliases, test timeout, env loader)
├── TEST_INFRA.md                         # Test infrastructure documentation (this file)
├── TEST_READY.md                         # Published test suite readiness certificate
└── tests/
    └── e2e/
        ├── harness/                      # Reusable test harness & test oracles
        │   ├── oracle.ts                 # Authoritative token math and physics rules
        │   ├── fixtures.ts               # Canonical payloads, violation scenarios, image evidence
        │   ├── db-validator.ts           # Migration SQL parser & schema integrity validator
        │   ├── auth-guard.ts             # Route guard, middleware, and PKCE callback inspector
        │   └── setup.ts                  # Test environment setup & network isolation
        ├── runner.ts                     # Standalone CLI runner with tier/feature filtering
        ├── tier1-features/               # Tier 1: Feature Coverage (>=5 tests/feature)
        │   ├── verify-api.test.ts        # POST /api/trips/verify core verification
        │   ├── token-calculation.test.ts # Base, Eco Multiplier, and Streak calculation
        │   ├── db-schema.test.ts         # Tables, columns, foreign keys, RLS policies
        │   └── auth-protection.test.ts   # PKCE callback, session persistence, route guards
        ├── tier2-boundaries/             # Tier 2: Boundary & Corner Cases (>=5 tests/feature)
        │   ├── verify-api-boundaries.test.ts # Speed (160 vs 160.01), Energy (0 vs -0.01), Distance, Timestamps
        │   ├── token-boundaries.test.ts  # Distance 0km, Eco 84.99 vs 85.00, Streak 4->5->6, 14->0
        │   ├── db-schema-boundaries.test.ts # Cascading delete, enum checks, defaults, constraints
        │   └── auth-boundaries.test.ts   # Open redirect sanitization, nested routes, token tampering
        ├── tier3-combinations/           # Tier 3: Cross-Feature Combinations
        │   └── cross-feature-combinations.test.ts # Pairwise interaction across all 4 features
        └── tier4-scenarios/              # Tier 4: Real-World Application Scenarios
            └── real-world-scenarios.test.ts # Commuter, 5-Trip Champion, Tamper Attack, Fleet Lifecycle
```

---

## 3. Authoritative Test Oracles

Expected outputs in all tests are derived from authoritative project requirements (`ORIGINAL_REQUEST.md` and `PROJECT.md`):

### 3.1 Token Economics Formula
- **Base Reward**: `Base = distance_km * 10`
- **Eco Multiplier Reward**: `Eco Multiplier = (eco_score / 100) * 0.5 * Base`
- **Streak Bonus**: `+50` every 5th consecutive qualifying trip (`eco_score >= 85`).
- **Streak Break**: Any trip with `eco_score < 85` resets `current_streak` to `0` with 0 bonus.
- **Total Reward**: `tokens_earned = Base + Eco Multiplier + Streak Bonus`.

### 3.2 Physics Sanity Rules
- **Speed Limit**: Maximum speed and average speed must not exceed `160 km/h`. Speed `> 160 km/h` must be rejected with HTTP 400.
- **Energy Consumption**: `energy_used_kwh` must be non-negative (`>= 0`). Negative energy must be rejected with HTTP 400.
- **Distance**: Must be `>= 0` and `<= 500 km`.
- **Temporal Order**: `end_time` must be strictly after `start_time`. Future start times and backwards duration must be rejected.
- **Evidence Validity**: Photo captured timestamp must be within 5 minutes of trip start.

### 3.3 Database Integrity
- Required tables: `drivers`, `vehicles`, `trips`, `telemetry_points`, `brigacoin_transactions`.
- Cascading delete: `telemetry_points(trip_id) -> trips(id) ON DELETE CASCADE`.
- RLS Security: Direct client `INSERT` on `brigacoin_transactions` is strictly prohibited. Ledger credits must be executed exclusively by the server/service role.

### 3.4 Authentication & Route Protection
- Protected routes: `/admin`, `/company`, `/rewards`, `/special-track`, `/verify`, `/go`.
- Unauthenticated access redirects to `/login?next=...` with HTTP 307.
- Insecure client `localStorage` flags (`drivee_logged_in = 'true'`) do not bypass server-side route guards.

---

## 4. Execution Commands

### Run Full E2E Test Suite
```bash
npx vitest run tests/e2e
```

### Run by Specific Tier
```bash
# Tier 1: Feature Coverage
npx vitest run tests/e2e/tier1-features

# Tier 2: Boundary & Corner Cases
npx vitest run tests/e2e/tier2-boundaries

# Tier 3: Cross-Feature Combinations
npx vitest run tests/e2e/tier3-combinations

# Tier 4: Real-World Application Scenarios
npx vitest run tests/e2e/tier4-scenarios
```

### Run via Test Runner Harness
```bash
node --experimental-strip-types tests/e2e/runner.ts
node --experimental-strip-types tests/e2e/runner.ts --tier=1
node --experimental-strip-types tests/e2e/runner.ts --feature=token
```

---

## 5. Network Isolation & Determinism

The test harness uses `tests/e2e/harness/setup.ts` to mock outbound HTTP requests to remote Supabase and OSRM endpoints. This ensures:
- Zero external network dependencies.
- Sub-second execution speeds (~800ms for 62 tests).
- Deterministic, reproducible results across local developer workstations and CI/CD pipelines.
