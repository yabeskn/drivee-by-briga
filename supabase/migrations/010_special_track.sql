-- ─────────────────────────────────────────────────────────────
-- Drivee by Briga — Special Track (lowongan kerja eksklusif driver)
--
-- Halaman /special-track sebelumnya menampilkan dua lowongan yang
-- di-hardcode di dalam komponen React dan tombol "Apply" hanya
-- menampilkan toast sukses tanpa menyimpan apa pun.
--
-- Migrasi ini membuat sumber data sungguhan:
--   - special_track_jobs       : katalog lowongan (dipublish perusahaan)
--   - special_track_applications: lamaran driver (satu per driver per lowongan)
--
-- Aturan kelayakan (dievaluasi server-side di src/lib/special-track.ts):
--   - lowongan harus berstatus 'open'
--   - average_eco_score driver >= min_eco_score (bila diset)
--   - kategori kendaraan driver harus cocok (bila diset)
--   - satu driver hanya boleh melamar satu kali per lowongan
-- ─────────────────────────────────────────────────────────────

-- ── 1. Tabel lowongan ───────────────────────────────────────
-- CATATAN TIPE: `companies.id` adalah VARCHAR(255) (lihat migrasi 002), BUKAN UUID.
-- FK di sini harus memakai VARCHAR agar kompatibel; memakai UUID akan gagal dengan
-- "Key columns are of incompatible types: uuid and character varying".
CREATE TABLE IF NOT EXISTS special_track_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id VARCHAR(255) REFERENCES companies(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  requirements JSONB NOT NULL DEFAULT '[]'::JSONB,
  vehicle_category VARCHAR(20) CHECK (vehicle_category IN ('standard', 'professional', 'premium', 'premium_plus')),
  min_eco_score INTEGER CHECK (min_eco_score IS NULL OR (min_eco_score >= 0 AND min_eco_score <= 100)),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_special_track_jobs_status ON special_track_jobs (status);

-- ── 2. Tabel lamaran ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS special_track_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES special_track_jobs(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'reviewing', 'accepted', 'rejected', 'withdrawn')),
  eco_score_at_apply NUMERIC(5,2),
  vehicle_category_at_apply VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Jaminan idempotensi: satu driver hanya bisa melamar satu kali per lowongan.
-- INSERT ganda akan ditolak database, bukan hanya dicegah di aplikasi.
CREATE UNIQUE INDEX IF NOT EXISTS uq_special_track_application
  ON special_track_applications (job_id, driver_id);

CREATE INDEX IF NOT EXISTS idx_special_track_applications_driver
  ON special_track_applications (driver_id, created_at DESC);

-- ── 3. RLS ──────────────────────────────────────────────────
ALTER TABLE special_track_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_track_applications ENABLE ROW LEVEL SECURITY;

-- Lowongan: semua pengguna terautentikasi boleh membaca yang berstatus open.
DO $$ BEGIN
  CREATE POLICY "Authenticated can read open jobs" ON special_track_jobs
    FOR SELECT TO authenticated USING (status = 'open');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Lamaran: driver hanya boleh membaca lamaran miliknya sendiri.
DO $$ BEGIN
  CREATE POLICY "Drivers can read own applications" ON special_track_applications
    FOR SELECT TO authenticated
    USING (driver_id = (SELECT auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- INSERT tidak diberi policy untuk `authenticated` — hanya service_role yang
-- boleh menulis, sehingga klien browser tidak bisa melamar atas nama driver lain.
-- (pola yang sama dipakai activity_logs di migrasi 009)

-- ── 4. Seed lowongan demo ───────────────────────────────────
-- company_id sengaja NULL karena tabel `companies` di produksi berisi data
-- perusahaan nyata; lowongan demo tidak boleh dikaitkan ke sana.
INSERT INTO special_track_jobs (
  title, description, requirements, vehicle_category, min_eco_score, status
)
SELECT
  'EV Fleet Driver - Premium Route',
  'Join our premium EV shuttle service with competitive rates and flexible schedule.',
  '["Valid SIM B1", "Min 1 year driving experience", "Clean driving record"]'::JSONB,
  'premium', 85, 'open'
WHERE NOT EXISTS (
  SELECT 1 FROM special_track_jobs WHERE title = 'EV Fleet Driver - Premium Route'
);

INSERT INTO special_track_jobs (
  title, description, requirements, vehicle_category, min_eco_score, status
)
SELECT
  'Corporate Shuttle Driver',
  'Provide shuttle service for corporate clients with professional standards.',
  '["Valid SIM B1", "Professional appearance", "Good communication skills"]'::JSONB,
  'professional', 80, 'open'
WHERE NOT EXISTS (
  SELECT 1 FROM special_track_jobs WHERE title = 'Corporate Shuttle Driver'
);