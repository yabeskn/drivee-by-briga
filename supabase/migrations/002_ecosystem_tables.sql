-- ─────────────────────────────────────────────────────────────
-- 002_ecosystem_tables.sql
-- Drifee ↔ Briga.id Ecosystem Integration
-- 
-- Adds: rewards, redemptions, companies tables
-- Extends: trips (telemetry columns), drivers (streak/stats)
-- Completes: RLS policies for INSERT operations
-- ─────────────────────────────────────────────────────────────

-- ── Rewards Catalog ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(20) CHECK (category IN (
    'internal','voucher','ewallet','transport',
    'insurance','maintenance','carbon'
  )),
  cost INTEGER NOT NULL,
  stock INTEGER DEFAULT 0,
  image_url TEXT,
  terms TEXT,
  reward_type VARCHAR(20),
  partner_id UUID,
  vehicle_category VARCHAR(20),
  user_type VARCHAR(20) DEFAULT 'all',
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Redemptions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  reward_id UUID REFERENCES rewards(id),
  cost INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed','cancelled')),
  voucher_code VARCHAR(100),
  delivery_method VARCHAR(20) DEFAULT 'auto',
  redeemed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Companies (for HR Rental / ESG) ────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  industry VARCHAR(100),
  contact_phone VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Extend trips table with telemetry summary columns ──────
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

-- ── Extend drivers table with streak/stats ─────────────────
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS total_trips INTEGER DEFAULT 0;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS average_eco_score DECIMAL(4,1) DEFAULT 0;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'driver';

-- ── Add company_id FK to hr_rentals (if not exists) ────────
DO $$
DECLARE
  comp_id_type text;
  hr_comp_type text;
BEGIN
  -- Check column types
  SELECT data_type INTO comp_id_type
  FROM information_schema.columns 
  WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'id';

  SELECT data_type INTO hr_comp_type
  FROM information_schema.columns 
  WHERE table_schema = 'public' AND table_name = 'hr_rentals' AND column_name = 'company_id';

  -- If companies.id is varchar/text and hr_rentals.company_id is uuid, alter hr_rentals.company_id
  IF comp_id_type LIKE '%char%' OR comp_id_type = 'text' THEN
    IF hr_comp_type = 'uuid' THEN
      ALTER TABLE hr_rentals ALTER COLUMN company_id TYPE VARCHAR(255);
    END IF;
  ELSIF comp_id_type = 'uuid' THEN
    IF hr_comp_type IS NOT NULL AND hr_comp_type != 'uuid' THEN
      ALTER TABLE hr_rentals ALTER COLUMN company_id TYPE UUID USING company_id::uuid;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_hr_company'
  ) THEN
    ALTER TABLE hr_rentals ADD CONSTRAINT fk_hr_company
      FOREIGN KEY (company_id) REFERENCES companies(id);
  END IF;
END $$;

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_redemptions_driver ON redemptions(driver_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_status ON redemptions(status);
CREATE INDEX IF NOT EXISTS idx_rewards_status ON rewards(status);
CREATE INDEX IF NOT EXISTS idx_rewards_category ON rewards(category);
CREATE INDEX IF NOT EXISTS idx_trips_created ON trips(created_at);
CREATE INDEX IF NOT EXISTS idx_trips_eco_score ON trips(eco_score);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);

-- ── RLS: Complete policies ──────────────────────────────────

-- Trips: drivers can INSERT their own trips
DO $$ BEGIN
  CREATE POLICY "Drivers can insert own trips" ON trips
    FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = driver_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- BrigaCoin: drivers CANNOT insert transactions directly (restricted to service_role)
DROP POLICY IF EXISTS "Drivers can insert own transactions" ON brigacoin_transactions;

-- Rewards: anyone authenticated can read active rewards
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Anyone can read active rewards" ON rewards
    FOR SELECT TO authenticated USING (status = 'active');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Redemptions: drivers can read/insert own
ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Drivers can read own redemptions" ON redemptions
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) = driver_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Drivers can insert own redemptions" ON redemptions
    FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = driver_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Companies: public read for now
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public read companies" ON companies
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Seed reward catalog ─────────────────────────────────────
INSERT INTO rewards (name, description, category, cost, stock, reward_type, user_type, status)
SELECT * FROM (VALUES
  ('Premium Analytics', 'Advanced trip analytics & reports for 30 days', 'internal', 50, 999, 'feature', 'driver', 'active'),
  ('Subscription Discount 20%', '20% off briga.id subscription', 'internal', 100, 999, 'discount', 'all', 'active'),
  ('Profile Boost', 'Highlight talent profile for 7 days', 'internal', 80, 999, 'feature', 'all', 'active'),
  ('Priority Support', 'Fast-track customer service', 'internal', 30, 999, 'service', 'all', 'active'),
  ('Training Discount 15%', '15% off Briga Academy courses', 'internal', 150, 999, 'discount', 'all', 'active'),
  ('Briga Merchandise', 'Briga branded items', 'internal', 200, 100, 'physical', 'all', 'active'),
  ('Voucher GoFood Rp 25K', 'GoFood voucher worth Rp 25,000', 'voucher', 50, 500, 'voucher', 'all', 'active'),
  ('Voucher Tokopedia Rp 50K', 'Tokopedia voucher worth Rp 50,000', 'voucher', 100, 500, 'voucher', 'all', 'active'),
  ('Top-up GoPay Rp 50K', 'GoPay top-up worth Rp 50,000', 'ewallet', 100, 500, 'auto_credit', 'all', 'active'),
  ('Top-up e-toll Rp 100K', 'Mandiri e-toll top-up worth Rp 100,000', 'transport', 200, 500, 'auto_credit', 'all', 'active'),
  ('Servis Mobil Rp 200K', 'Car service voucher worth Rp 200,000', 'maintenance', 300, 200, 'voucher', 'driver', 'active'),
  ('Diskon Asuransi 10%', '10% discount on vehicle insurance', 'insurance', 400, 100, 'discount', 'driver', 'active'),
  ('Carbon Offset 10 kg CO₂', 'Offset 10 kg CO₂ emissions', 'carbon', 5, 9999, 'voucher', 'all', 'active'),
  ('Carbon Offset 100 kg CO₂', 'Offset 100 kg CO₂ emissions', 'carbon', 50, 9999, 'voucher', 'all', 'active'),
  ('Carbon Offset 1 ton CO₂', 'Offset 1 ton CO₂ emissions', 'carbon', 500, 9999, 'voucher', 'all', 'active')
) AS v(name, description, category, cost, stock, reward_type, user_type, status)
WHERE NOT EXISTS (SELECT 1 FROM rewards LIMIT 1);
