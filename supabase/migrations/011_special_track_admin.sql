-- ─────────────────────────────────────────────────────────────
-- Drivee by Briga — Special Track: dukungan alur publish admin
--
-- Migrasi 010 membuat tabel special_track_jobs / _applications beserta dua
-- baris data demo hasil seed. Yang belum ada adalah alur untuk mengelola
-- lowongan itu dari sisi admin. Migrasi ini menambah jejaknya.
--
-- Yang ditambahkan:
--   - created_by / updated_at / closed_at / is_seed  pada special_track_jobs
--   - reviewed_by / reviewed_at / review_note        pada _applications
--   - index pendukung untuk query review per lowongan
--   - trigger pemelihara updated_at
--
-- Catatan penting soal 'is_seed':
--   Dua baris seed dari migrasi 010 TIDAK dihapus di sini, hanya ditandai.
--   Menghapus data tanpa persetujuan berisiko menghilangkan lamaran driver
--   yang nyata; sebagai gantinya baris seed ditandai is_seed = TRUE supaya
--   admin bisa menghapusnya sendiri lewat UI yang sekarang ada.
-- ─────────────────────────────────────────────────────────────

-- ── 1. Kolom audit lowongan ──────────────────────────────────
ALTER TABLE special_track_jobs
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_seed BOOLEAN NOT NULL DEFAULT FALSE;

-- created_by sengaja TANPA foreign key ke drivers(id): admin belum tentu
-- punya baris driver. Nilainya adalah auth uid dari sesi terverifikasi,
-- disimpan sebagai jejak audit dan dibaca lewat service_role.

-- ── 2. Kolom review lamaran ──────────────────────────────────
ALTER TABLE special_track_applications
  ADD COLUMN IF NOT EXISTS reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_note TEXT;

-- ── 3. Tandai lowongan seed dari migrasi 010 ──────────────────
-- Dicocokkan lewat judul + company_id IS NULL supaya lowongan yang dibuat
-- admin (yang punya company_id) tidak ikut ditandai.
UPDATE special_track_jobs
   SET is_seed = TRUE
 WHERE is_seed = FALSE
   AND company_id IS NULL
   AND title IN ('EV Fleet Driver - Premium Route', 'Corporate Shuttle Driver');

-- ── 4. Index untuk halaman review ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_special_track_applications_job_status
  ON special_track_applications (job_id, status);

CREATE INDEX IF NOT EXISTS idx_special_track_applications_reviewed
  ON special_track_applications (reviewed_at DESC)
  WHERE reviewed_at IS NOT NULL;

-- ── 5. Trigger pemelihara updated_at ──────────────────────────
CREATE OR REPLACE FUNCTION trg_set_special_track_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  -- Menutup lowongan harus meninggalkan jejak waktunya; membuka kembali
  -- membersihkan jejamya supaya tidak menyesatkan saat dibaca ulang.
  IF NEW.status = 'closed' AND OLD.status IS DISTINCT FROM 'closed' THEN
    NEW.closed_at = NOW();
  ELSIF NEW.status = 'open' AND OLD.status IS DISTINCT FROM 'open' THEN
    NEW.closed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_special_track_jobs_updated_at ON special_track_jobs;

CREATE TRIGGER trg_special_track_jobs_updated_at
  BEFORE UPDATE ON special_track_jobs
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_special_track_jobs_updated_at();