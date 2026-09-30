-- ─────────────────────────────────────────────────────────────
-- Drivee by Briga - Initial Database Schema
-- Supabase PostgreSQL
-- ─────────────────────────────────────────────────────────────

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Drivers Table ────────────────────────────────────────────
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  google_id VARCHAR(255) UNIQUE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  avatar_url TEXT,
  total_briga_coins INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  average_eco_score DECIMAL(5,2) DEFAULT 0,
  total_trips_completed INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Vehicles Table ───────────────────────────────────────────
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  model VARCHAR(255),
  license_plate VARCHAR(20) UNIQUE NOT NULL,
  battery_capacity_kwh DECIMAL(6,2),
  efficiency_kwh_per_100km DECIMAL(5,2),
  hub_location VARCHAR(255),
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'in_service', 'charging', 'maintenance')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Trips Table ──────────────────────────────────────────────
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id VARCHAR(50) UNIQUE NOT NULL,
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  profile_used VARCHAR(20) CHECK (profile_used IN ('HIGHWAY_NORMAL', 'URBAN_RUSH_HOUR')),
  start_battery_soc DECIMAL(5,2),
  end_battery_soc DECIMAL(5,2),
  start_odometer_km DECIMAL(10,2),
  end_odometer_km DECIMAL(10,2),
  distance_km DECIMAL(8,2) DEFAULT 0,
  energy_used_kwh DECIMAL(8,2) DEFAULT 0,
  eco_score INTEGER DEFAULT 0,
  eco_grade VARCHAR(2),
  tokens_earned INTEGER DEFAULT 0,
  trip_hash VARCHAR(64),
  verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  esg_co2_avoided_kg DECIMAL(8,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Telemetry Points Table ───────────────────────────────────
CREATE TABLE telemetry_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  timestamp BIGINT NOT NULL,
  lat DECIMAL(10,8) NOT NULL,
  lng DECIMAL(11,8) NOT NULL,
  accuracy DECIMAL(6,2),
  speed_mps DECIMAL(6,2),
  speed_kmh DECIMAL(6,2),
  heading DECIMAL(5,2),
  altitude DECIMAL(8,2),
  accel_x DECIMAL(6,3),
  accel_y DECIMAL(6,3),
  accel_z DECIMAL(6,3),
  accel_magnitude DECIMAL(6,3),
  polling_interval_ms INTEGER,
  is_accel_paused BOOLEAN DEFAULT FALSE,
  driving_status VARCHAR(20) CHECK (driving_status IN ('smooth', 'harsh_accel', 'sudden_brake', 'idle')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── BrigaCoin Transactions Table ────────────────────────────
CREATE TABLE briga_coin_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('earn', 'spend', 'expire', 'adjust')),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  source VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Trip Rewards Table ───────────────────────────────────────
CREATE TABLE trip_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  base_reward INTEGER DEFAULT 0,
  eco_multiplier DECIMAL(3,2) DEFAULT 1.00,
  multiplier_reward INTEGER DEFAULT 0,
  streak_bonus INTEGER DEFAULT 0,
  anti_spoofing_bonus INTEGER DEFAULT 0,
  total_reward INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX idx_trips_driver_id ON trips(driver_id);
CREATE INDEX idx_trips_vehicle_id ON trips(vehicle_id);
CREATE INDEX idx_trips_trip_id ON trips(trip_id);
CREATE INDEX idx_trips_verification_status ON trips(verification_status);
CREATE INDEX idx_telemetry_trip_id ON telemetry_points(trip_id);
CREATE INDEX idx_telemetry_timestamp ON telemetry_points(timestamp);
CREATE INDEX idx_briga_coin_driver_id ON briga_coin_transactions(driver_id);
CREATE INDEX idx_briga_coin_trip_id ON briga_coin_transactions(trip_id);
CREATE INDEX idx_trip_rewards_trip_id ON trip_rewards(trip_id);

-- ── Update Trigger Function ─────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- ── Apply Update Triggers ────────────────────────────────────
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trips FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
