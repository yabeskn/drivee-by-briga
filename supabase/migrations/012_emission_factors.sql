-- ─────────────────────────────────────────────────────────────
-- 012_emission_factors.sql — Faktor emisi grid berversi
--
-- Catatan penomoran: slot 005 sudah dipakai 005_unified_brigacoin.sql
-- (sudah ada di repo), jadi tabel ini memakai nomor berikutnya (012).
--
-- Faktor emisi disimpan berversi (valid_from) supaya perhitungan CO₂
-- historis bisa direproduksi. Kolom `verified` + `source_ref` mencatat
-- apakah nilai sudah dicek ke dokumen primer.
--
-- ⚠️ Seed 0.87 kg CO₂/kWh BELUM terverifikasi terhadap Kepmen ESDM
-- 163.K/HK.02/MEM.S/2021 → verified = false. Setelah dicek, tambah
-- versi baru (jangan UPDATE) dengan verified = true.
-- Non-destructive & idempotent.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.emission_factors (
  id            BIGSERIAL PRIMARY KEY,
  factor_key    TEXT        NOT NULL,                -- mis. 'grid_jamali'
  kg_co2_per_kwh NUMERIC(6,4) NOT NULL CHECK (kg_co2_per_kwh > 0),
  version       INTEGER     NOT NULL DEFAULT 1,
  valid_from    DATE        NOT NULL DEFAULT CURRENT_DATE,
  source_ref    TEXT,
  verified      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (factor_key, version)
);

CREATE INDEX IF NOT EXISTS idx_emission_factors_key_valid
  ON public.emission_factors (factor_key, valid_from DESC);

ALTER TABLE public.emission_factors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS emission_factors_read ON public.emission_factors;
CREATE POLICY emission_factors_read ON public.emission_factors
  FOR SELECT USING (true);
-- Tulis hanya via service role (tanpa policy INSERT/UPDATE).

INSERT INTO public.emission_factors
  (factor_key, kg_co2_per_kwh, version, source_ref, verified)
VALUES
  ('grid_jamali', 0.8700, 1,
   'Kepmen ESDM 163.K/HK.02/MEM.S/2021 — BELUM diverifikasi ke lampiran', FALSE)
ON CONFLICT (factor_key, version) DO NOTHING;
