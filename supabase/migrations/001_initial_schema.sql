-- ─────────────────────────────────────────────────────────────
-- Drifee by Briga — Initial Database Schema
-- Supabase PostgreSQL
-- ─────────────────────────────────────────────────────────────

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Drivers ─────────────────────────────────────────────────
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id VARCHAR(255) UNIQUE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  phone_verified BOOLEAN DEFAULT FALSE,
  vehicle_id UUID,
  briga_coin_balance INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Vehicles ────────────────────────────────────────────────
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  category VARCHAR(20) CHECK (category IN ('standard', 'professional', 'premium', 'premium_plus')),
  brand VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  license_plate VARCHAR(20) UNIQUE NOT NULL,
  battery_capacity_kwh DECIMAL(5,2),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key from drivers to vehicles
ALTER TABLE drivers ADD CONSTRAINT fk_vehicle
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id);

-- ── Trips ───────────────────────────────────────────────────
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  distance_km DECIMAL(8,2),
  eco_score INTEGER,
  eco_grade VARCHAR(2),
  tokens_earned INTEGER DEFAULT 0,
  trip_hash VARCHAR(64),
  verification_status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── BrigaCoin Transactions ──────────────────────────────────
CREATE TABLE brigacoin_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  type VARCHAR(20) CHECK (type IN ('earn', 'spend', 'expire', 'adjust')),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  source VARCHAR(50),
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── HR Rentals ──────────────────────────────────────────────
CREATE TABLE hr_rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  package_type VARCHAR(20),
  vehicle_id UUID REFERENCES vehicles(id),
  driver_id UUID REFERENCES drivers(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_price DECIMAL(12,2),
  payment_status VARCHAR(20) DEFAULT 'pending',
  payment_reference VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Scope 3 Emissions ───────────────────────────────────────
CREATE TABLE scope3_emissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  rental_id UUID REFERENCES hr_rentals(id) ON DELETE CASCADE,
  category VARCHAR(20),
  distance_km DECIMAL(8,2),
  emission_factor DECIMAL(6,4),
  total_emission_kg DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Carbon Offsets ──────────────────────────────────────────
CREATE TABLE carbon_offsets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  amount_kg DECIMAL(10,2),
  type VARCHAR(20),
  cost DECIMAL(12,2),
  brc_earned INTEGER,
  certificate_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX idx_drivers_email ON drivers(email);
CREATE INDEX idx_drivers_google_id ON drivers(google_id);
CREATE INDEX idx_vehicles_driver_id ON vehicles(driver_id);
CREATE INDEX idx_trips_driver_id ON trips(driver_id);
CREATE INDEX idx_trips_vehicle_id ON trips(vehicle_id);
CREATE INDEX idx_brigacoin_driver_id ON brigacoin_transactions(driver_id);
CREATE INDEX idx_hr_rentals_company_id ON hr_rentals(company_id);
CREATE INDEX idx_scope3_company_id ON scope3_emissions(company_id);

-- ── RLS Policies ────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE brigacoin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE scope3_emissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE carbon_offsets ENABLE ROW LEVEL SECURITY;

-- Drivers: users can read/update their own data
CREATE POLICY "Drivers can read own data" ON drivers
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Drivers can update own data" ON drivers
  FOR UPDATE USING (auth.uid()::text = id::text);

-- Vehicles: users can read their own vehicles
CREATE POLICY "Users can read own vehicles" ON vehicles
  FOR SELECT USING (auth.uid()::text = driver_id::text);

-- Trips: users can read their own trips
CREATE POLICY "Users can read own trips" ON trips
  FOR SELECT USING (auth.uid()::text = driver_id::text);

-- BrigaCoin: users can read their own transactions
CREATE POLICY "Users can read own transactions" ON brigacoin_transactions
  FOR SELECT USING (auth.uid()::text = driver_id::text);

-- ── Storage Bucket ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('drifee-photos', 'drifee-photos', true);

-- Storage policy: anyone can read
CREATE POLICY "Public read access" ON storage.objects
  FOR SELECT USING (bucket_id = 'drifee-photos');

-- Storage policy: authenticated users can upload
CREATE POLICY "Authenticated upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'drifee-photos' AND auth.role() = 'authenticated');
