-- ─────────────────────────────────────────────────────────────
-- Migration 008: Vehicles Bluetooth Binding & Rental Partner Management
-- Adds code, name, bluetooth_name, rental_partner_name, rental_partner_phone,
-- qr_code_token, and last_odometer_km to the vehicles table for decentralized fleet operations.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS bluetooth_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS rental_partner_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS rental_partner_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS qr_code_token VARCHAR(100),
  ADD COLUMN IF NOT EXISTS hub_location VARCHAR(255),
  ADD COLUMN IF NOT EXISTS efficiency_kwh_per_100km DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS last_odometer_km DECIMAL(10,2) DEFAULT 0;

-- Create index for quick lookup by bluetooth identifier
CREATE INDEX IF NOT EXISTS idx_vehicles_code ON vehicles(code);
CREATE INDEX IF NOT EXISTS idx_vehicles_bluetooth_name ON vehicles(bluetooth_name);
CREATE INDEX IF NOT EXISTS idx_vehicles_qr_code_token ON vehicles(qr_code_token);

-- Update existing vehicle record in live database if present
UPDATE vehicles
SET
  code = 'EV-02',
  name = COALESCE(name, 'Hyundai Ioniq 5 Signature'),
  bluetooth_name = 'IONIQ-5-DRIFEE',
  rental_partner_name = 'PT Jababeka Rental Armada',
  rental_partner_phone = '081388776655',
  qr_code_token = 'QR-BRG-EV02',
  last_odometer_km = 28910.0,
  hub_location = 'Koridor Halim - Cikarang',
  efficiency_kwh_per_100km = 14.5
WHERE license_plate = 'B_3006_CHL' OR license_plate = 'B 5678 DRI';

-- Insert Wuling Air EV unit if not already present
INSERT INTO vehicles (
  code, name, brand, model, license_plate, battery_capacity_kwh,
  status, bluetooth_name, rental_partner_name, rental_partner_phone,
  qr_code_token, last_odometer_km, hub_location, efficiency_kwh_per_100km
)
SELECT
  'EV-01', 'Wuling Air EV Long Range', 'Wuling', 'Air EV (26.7 kWh)', 'B 1234 EV', 26.7,
  'available', 'WULING-AIR-01', 'Mitra Rental Berkah Cikarang', '081298765432',
  'QR-BRG-EV01', 14250.0, 'Koridor Cikarang Dry Port', 10.1
WHERE NOT EXISTS (
  SELECT 1 FROM vehicles WHERE license_plate = 'B 1234 EV' OR code = 'EV-01'
);
