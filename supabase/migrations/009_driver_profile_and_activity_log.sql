-- ─────────────────────────────────────────────────────────────
-- Drivee by Briga — Driver Profile Completion & Activity Log
--
-- Men colonized kolom yang dipakai alur registrasi/CRM (/api/crm/driver,
-- /api/register/*) dan tabel activity_logs untuk /api/activity/log.
-- Sebelumnya endpoint-endpoint tersebut hanya membalas sukses tanpa
-- menyimpan apa pun ke database.
-- ─────────────────────────────────────────────────────────────

-- ── 1. Profil driver untuk alur registrasi & CRM ────────────
-- Catatan: tabel `drivers` awalnya memakai kolom `name` (bukan `full_name`),
-- jadi `full_name` ditambahkan sebagai kolom terpisah tanpa merusak kode lama.
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Identitasgovernmental
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS ktp VARCHAR(32);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS sim_type VARCHAR(10);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS sim_number VARCHAR(32);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS sim_expiry DATE;

-- Alamat & kontak darurat
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS emergency_name VARCHAR(255);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS emergency_phone VARCHAR(20);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS emergency_relation VARCHAR(50);

-- Rekening (bank_name / bank_account_number / bank_account_holder sudah ada di 007)
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS bank_other VARCHAR(100);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS license_type VARCHAR(20);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS license_number VARCHAR(50);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS license_expiry DATE;

-- Status vetting driver (pending_verification / active / rejected / suspended)
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS registration_status VARCHAR(30) DEFAULT 'pending_verification';

-- Backfill kolom turunan agar data lama tetap konsisten
UPDATE drivers SET full_name = name WHERE full_name IS NULL;

-- ── 2. Profil kendaraan dari alur registrasi /api/register/vehicle ──
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS color VARCHAR(50);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS production_year INTEGER;
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS ownership_status VARCHAR(20)
    CHECK (ownership_status IN ('company', 'leased', 'personal', 'consortium'));
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(20);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS chassis_number VARCHAR(50);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS engine_number VARCHAR(50);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS stnk_expiry DATE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS leasing_company VARCHAR(255);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS leasing_contract_end DATE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS consortium_name VARCHAR(255);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS consortium_members TEXT;
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS registration_status VARCHAR(30) DEFAULT 'pending_verification';

-- ⚠️ Bukti foto (STNK/BPKB/foto kendaraan) BELUM punya kolom.
-- Formulir saat ini mengirim JSON.stringify(formData), sehingga objek File
-- tiba sebagai `{}` dan tidak pernah bisa diunggah. Penyimpanan berkas
-- memerlukan Supabase Storage + multipart/form-data — lihat TEST_READY / HANDOVER.

-- ── 3. Tabel activity_logs ──────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('login','trip','verification','app_usage','error','feature')),
  action VARCHAR(255) NOT NULL,
  status VARCHAR(50),
  metadata JSONB DEFAULT '{}'::JSONB,
  ip_address VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_driver ON activity_logs (driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON activity_logs (type, created_at DESC);

-- ── 4. RLS: log hanya boleh dibaca oleh pemiliknya ──────────
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can read own activity logs" ON activity_logs
    FOR SELECT TO authenticated
    USING (driver_id = (SELECT auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- INSERT sengaja TIDAK diberi policy untuk `authenticated`:
-- hanya service_role (server) yang boleh menulis log, agar klien browser
-- tidak bisa menyuntik baris palsu ke jejak audit.
-- (pola yang sama dipakai brigacoin_transactions di migrasi 004)

-- INSERT/SELECT untuk service_role otomatis: service_role melewati RLS.