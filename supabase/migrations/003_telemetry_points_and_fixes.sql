-- ─────────────────────────────────────────────────────────────
-- 003_telemetry_points_and_fixes.sql
-- Drive-e by Briga Smart EV Fleet Telematics
-- Telemetry Points, Model Integrity & RLS Hardening
-- ─────────────────────────────────────────────────────────────

-- ── 1. Telemetry Points Table ───────────────────────────────
CREATE TABLE IF NOT EXISTS telemetry_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  speed_kmh NUMERIC NOT NULL DEFAULT 0,
  battery_soc NUMERIC,
  power_kw NUMERIC,
  accelerometer_x NUMERIC,
  accelerometer_y NUMERIC,
  accelerometer_z NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Telemetry Points Indexes ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_telemetry_points_trip_id ON telemetry_points(trip_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_points_timestamp ON telemetry_points(timestamp);

-- ── 3. Telemetry Points RLS ─────────────────────────────────
ALTER TABLE telemetry_points ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Drivers can view own trip telemetry" ON telemetry_points
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM trips
        WHERE trips.id = telemetry_points.trip_id
          AND trips.driver_id = (SELECT auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Drivers can insert own trip telemetry" ON telemetry_points
    FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM trips
        WHERE trips.id = telemetry_points.trip_id
          AND trips.driver_id = (SELECT auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 4. Ensure Drivers Model Integrity ───────────────────────
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS total_trips INTEGER DEFAULT 0;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS average_eco_score NUMERIC DEFAULT 0;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'driver';

-- ── 5. Ensure Trips Telemetry Summary Columns ───────────────
ALTER TABLE trips ADD COLUMN IF NOT EXISTS profile_used VARCHAR(20);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS start_battery_soc INTEGER;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS end_battery_soc INTEGER;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS energy_used_kwh DECIMAL(6,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS harsh_accelerations INTEGER DEFAULT 0;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS harsh_brakings INTEGER DEFAULT 0;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS idle_duration_seconds INTEGER DEFAULT 0;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS max_speed_kmh DECIMAL(5,1);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS avg_speed_kmh DECIMAL(5,1);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS co2_avoided_kg DECIMAL(6,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS osrm_matched_route JSONB;

-- ── 6. Harden BrigaCoin Transactions RLS ────────────────────
-- Drop insecure driver direct insert policy; restricted to server/service_role only
DROP POLICY IF EXISTS "Drivers can insert own transactions" ON brigacoin_transactions;

-- Ensure drivers can read their own transactions
DO $$ BEGIN
  CREATE POLICY "Users can read own transactions" ON brigacoin_transactions
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = driver_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 7. Ensure Complete RLS Policies on Drivers, Vehicles, Trips ──
-- Drivers: INSERT
DO $$ BEGIN
  CREATE POLICY "Drivers can insert own profile" ON drivers
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Drivers: UPDATE
DO $$ BEGIN
  CREATE POLICY "Drivers can update own profile" ON drivers
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = id)
    WITH CHECK ((SELECT auth.uid()) = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Vehicles: INSERT
DO $$ BEGIN
  CREATE POLICY "Drivers can insert own vehicles" ON vehicles
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = driver_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Vehicles: UPDATE
DO $$ BEGIN
  CREATE POLICY "Drivers can update own vehicles" ON vehicles
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = driver_id)
    WITH CHECK ((SELECT auth.uid()) = driver_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Vehicles: DELETE
DO $$ BEGIN
  CREATE POLICY "Drivers can delete own vehicles" ON vehicles
    FOR DELETE TO authenticated
    USING ((SELECT auth.uid()) = driver_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Trips: UPDATE
DO $$ BEGIN
  CREATE POLICY "Drivers can update own trips" ON trips
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = driver_id)
    WITH CHECK ((SELECT auth.uid()) = driver_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
