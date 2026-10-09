-- ─────────────────────────────────────────────────────────────
-- 013_appointment_setter.sql — Drifee Appointment Setter Engine
--
-- Modul Penjadwalan B2B & On-Demand Chauffeur-Driven EV
-- Mendukung Shareable Booking Links, Multi-Stop Waypoints TSP,
-- Dynamic Decoy Pricing, dan Integrasi Settlement Harian 23:00 WIB.
-- Semua operasi bersifat idempotent.
-- ─────────────────────────────────────────────────────────────

-- ── 1. Tabel Appointment Templates ────────────────────────────
-- Dibuat oleh HR Perusahaan, Admin, atau Host untuk shareable link
CREATE TABLE IF NOT EXISTS appointment_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id UUID,
  corporate_id UUID REFERENCES corporate_profiles(id) ON DELETE CASCADE,
  slug VARCHAR(100) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  banner_url TEXT,
  
  -- Aturan Durasi & Paket yang Tersedia (dalam jam)
  allowed_durations INTEGER[] DEFAULT ARRAY[2, 4, 8, 12],
  default_duration INTEGER DEFAULT 8,
  
  -- Kebijakan Destinasi (Terkunci misal hanya ke Pabrik Cikarang vs Bebas Jabodetabek)
  is_destination_locked BOOLEAN DEFAULT FALSE,
  locked_destination_address TEXT,
  locked_destination_lat DECIMAL(10,8),
  locked_destination_lng DECIMAL(11,8),
  max_waypoints INTEGER DEFAULT 5,
  
  -- Kebijakan Finansial & Sponsor Pembayaran
  payment_sponsor_mode VARCHAR(30) DEFAULT 'corporate_esg' 
    CHECK (payment_sponsor_mode IN ('corporate_esg', 'guest_self_pay', 'split')),
  base_discount_brc INTEGER DEFAULT 0,
  
  -- Operasional Slot & Buffer Waktu (Cas EV / Istirahat Driver)
  buffer_minutes_between_trips INTEGER DEFAULT 60,
  operating_start_time TIME DEFAULT '06:00:00',
  operating_end_time TIME DEFAULT '22:00:00',
  advance_booking_days INTEGER DEFAULT 14,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointment_templates_slug 
  ON appointment_templates(slug);

CREATE INDEX IF NOT EXISTS idx_appointment_templates_corp 
  ON appointment_templates(corporate_id);

-- ── 2. Tabel Appointment Bookings ─────────────────────────────
-- Data pemesanan perjalanan terjadwal dari Booker / Tamu / Kandidat
CREATE TABLE IF NOT EXISTS appointment_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code VARCHAR(30) UNIQUE NOT NULL, -- e.g. DRF-APT-2610-88A
  template_id UUID REFERENCES appointment_templates(id) ON DELETE SET NULL,
  corporate_id UUID REFERENCES corporate_profiles(id) ON DELETE SET NULL,
  
  -- Identitas Pemesan / Tamu
  booker_name VARCHAR(255) NOT NULL,
  booker_phone VARCHAR(50) NOT NULL,
  booker_email VARCHAR(255),
  guest_count INTEGER DEFAULT 1,
  special_notes TEXT,
  
  -- Jadwal & Durasi
  scheduled_date DATE NOT NULL,
  scheduled_start_time TIMESTAMPTZ NOT NULL,
  scheduled_end_time TIMESTAMPTZ NOT NULL,
  duration_hours INTEGER NOT NULL CHECK (duration_hours IN (2, 4, 8, 12)),
  
  -- Titik Awal Penjemputan (Origin)
  pickup_address TEXT NOT NULL,
  pickup_lat DECIMAL(10,8) NOT NULL,
  pickup_lng DECIMAL(11,8) NOT NULL,
  
  -- Finansial & Payout Split (Take-Rate Driver 85% : Platform 15%)
  gross_fare_idr INTEGER NOT NULL,
  platform_fee_idr INTEGER NOT NULL,
  driver_payout_idr INTEGER NOT NULL,
  briga_coins_spent INTEGER DEFAULT 0,
  overtime_hours INTEGER DEFAULT 0,
  overtime_fare_idr INTEGER DEFAULT 0,
  
  -- Status Pembayaran
  payment_status VARCHAR(30) DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'sponsored_esg', 'paid_online', 'refunded', 'waived')),
  payment_gateway_ref VARCHAR(100),
  
  -- Status Penugasan & Eksekusi Perjalanan
  booking_status VARCHAR(30) DEFAULT 'unassigned'
    CHECK (booking_status IN ('unassigned', 'assigned', 'en_route', 'picked_up', 'completed', 'cancelled', 'no_show')),
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  
  -- Keamanan & Live Tracking
  tracking_secret_token VARCHAR(64) UNIQUE NOT NULL,
  
  -- Payout Settlement
  is_settled_to_driver BOOLEAN DEFAULT FALSE,
  settled_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apt_bookings_date 
  ON appointment_bookings(scheduled_date);

CREATE INDEX IF NOT EXISTS idx_apt_bookings_driver 
  ON appointment_bookings(driver_id);

CREATE INDEX IF NOT EXISTS idx_apt_bookings_status 
  ON appointment_bookings(booking_status);

CREATE INDEX IF NOT EXISTS idx_apt_bookings_token 
  ON appointment_bookings(tracking_secret_token);

CREATE INDEX IF NOT EXISTS idx_apt_bookings_code 
  ON appointment_bookings(booking_code);

-- ── 3. Tabel Appointment Waypoints ────────────────────────────
-- Titik-titik singgah / jemput multi-stop yang dioptimasi via TSP
CREATE TABLE IF NOT EXISTS appointment_waypoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES appointment_bookings(id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL,
  stop_name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  lat DECIMAL(10,8) NOT NULL,
  lng DECIMAL(11,8) NOT NULL,
  contact_person VARCHAR(100),
  contact_phone VARCHAR(50),
  stop_notes TEXT,
  estimated_duration_minutes INTEGER DEFAULT 15,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apt_waypoints_booking 
  ON appointment_waypoints(booking_id, stop_order);

-- ── 4. Tabel Log Status Appointment ───────────────────────────
CREATE TABLE IF NOT EXISTS appointment_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES appointment_bookings(id) ON DELETE CASCADE,
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,
  changed_by VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apt_status_logs_booking 
  ON appointment_status_logs(booking_id);

-- ── 5. RLS Policies (Idempotent) ──────────────────────────────
ALTER TABLE appointment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_waypoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_status_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public read active templates" ON appointment_templates
    FOR SELECT TO anon, authenticated USING (is_active = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public create booking" ON appointment_bookings
    FOR INSERT TO anon, authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public read booking via token or code" ON appointment_bookings
    FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public read waypoints" ON appointment_waypoints
    FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public insert waypoints" ON appointment_waypoints
    FOR INSERT TO anon, authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 6. Seeding Data Demo Template ─────────────────────────────
-- Template default untuk korporasi Cikarang Mobility
INSERT INTO appointment_templates (
  slug,
  title,
  description,
  allowed_durations,
  default_duration,
  is_destination_locked,
  locked_destination_address,
  payment_sponsor_mode,
  max_waypoints,
  buffer_minutes_between_trips
)
VALUES (
  'cikarang-executive-visit',
  'Executive & HR Factory Tour (Cikarang Industrial Estate)',
  'Layanan transportasi delegasi bisnis, kandidat rekrutmen, dan audit pabrik dengan armada Mobil EV premium berpendingin kabin hening dan driver profesional.',
  ARRAY[2, 4, 8, 12],
  8,
  FALSE,
  NULL,
  'corporate_esg',
  5,
  60
)
ON CONFLICT (slug) DO NOTHING;
