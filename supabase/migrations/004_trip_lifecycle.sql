-- ─────────────────────────────────────────────────────────────
-- 004_trip_lifecycle.sql — Trip Lifecycle & Invisible Security
--
-- Menambah kolom Scope 3 absolut (deadhead miles wajib terekam)
-- dan jejak Invisible Security pada tabel trips.
-- Menutup gap skema: tabel brigacoin_transactions, enum category
-- kendaraan, dan RLS wajib aktif di semua tabel inti.
-- Semua operasi idempotent (aman dijalankan berulang).
-- ─────────────────────────────────────────────────────────────

-- ── 1. Scope 3 breakdown ────────────────────────────────────
-- deadhead (jarak kosong menuju jemput) + revenue (jarak dengan
-- penumpang). deadhead + revenue = distance_km.
ALTER TABLE trips ADD COLUMN IF NOT EXISTS deadhead_distance_km DECIMAL(8,2) DEFAULT 0;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS revenue_distance_km DECIMAL(8,2) DEFAULT 0;

-- Timeline transisi state machine:
-- IDLE → DISPATCHED → PASSENGER_PICKED_UP → COMPLETED
ALTER TABLE trips ADD COLUMN IF NOT EXISTS trip_phase_timeline JSONB DEFAULT '[]'::jsonb;

-- Invisible Security: watchdog anomaly (Fake GPS detection)
ALTER TABLE trips ADD COLUMN IF NOT EXISTS watchdog_flagged BOOLEAN DEFAULT FALSE;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS watchdog_anomaly_reason TEXT;

-- Index untuk audit emisi per perusahaan / analitik deadhead
CREATE INDEX IF NOT EXISTS idx_trips_deadhead ON trips(deadhead_distance_km);
CREATE INDEX IF NOT EXISTS idx_trips_watchdog ON trips(watchdog_flagged);

-- ── 2. Tabel brigacoin_transactions (ledger, server-only) ───
-- Dipakai API verify & balance. Ledger tidak boleh diinsert
-- langsung oleh client — dijaga via RLS (service_role only).
CREATE TABLE IF NOT EXISTS brigacoin_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('earn', 'spend', 'expire', 'adjust')),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  source VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brigacoin_driver_id ON brigacoin_transactions(driver_id);
CREATE INDEX IF NOT EXISTS idx_brigacoin_trip_id ON brigacoin_transactions(trip_id);

-- ── 3. Enum category kendaraan (selaras schema.ts) ──────────
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS category VARCHAR(20) CHECK (category IN ('standard', 'professional', 'premium', 'premium_plus'));

-- ── 4. RLS wajib aktif di semua tabel inti ──────────────────
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE brigacoin_transactions ENABLE ROW LEVEL SECURITY;

-- ── 5. RLS policies (idempotent) ────────────────────────────
DO $$ BEGIN
  CREATE POLICY "Drivers can insert own trips" ON trips
    FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = driver_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ledger: client tidak boleh INSERT langsung — hanya service_role
DROP POLICY IF EXISTS "Drivers can insert own transactions" ON brigacoin_transactions;
DO $$ BEGIN
  CREATE POLICY "Users can read own transactions" ON brigacoin_transactions
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) = driver_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
