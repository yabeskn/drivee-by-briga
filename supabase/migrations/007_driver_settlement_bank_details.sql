-- ─────────────────────────────────────────────────────────────
-- 007_driver_settlement_bank_details.sql
-- Driver Payout Settlement & Bank Account Metadata
--
-- Menambahkan kolom rekening bank pada tabel drivers untuk
-- kelengkapan data agen rekapitulasi harian & transfer payroll.
-- Semua operasi bersifat idempotent.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE drivers ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(100);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS bank_account_holder VARCHAR(255);

-- Index pencarian pengemudi berdasarkan nomor rekening jika diperlukan
CREATE INDEX IF NOT EXISTS idx_drivers_bank_name ON drivers(bank_name);
