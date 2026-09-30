-- ─────────────────────────────────────────────────────────────
-- 006_corporate_green_commute.sql — Corporate Green Commute & ESG Perks
--
-- Menghubungkan Corporate ESG Pool (briga.id) dengan subsidi komuter
-- Mobil EV karyawan di Drifee (drifee.briga.id).
--
-- Kepatuhan Regulasi:
-- 1. UU Mata Uang No. 7/2011 & UU P2SK No. 4/2023 (Closed-Loop Service Discount)
-- 2. POJK No. 51/2017 & GHG Protocol Scope 3 Category 7 (Employee Commuting)
-- 3. Batas minimum subsidi fleksibel: min 5 BRC (Rp 25.000) per karyawan.
-- ─────────────────────────────────────────────────────────────

-- ── 1. Tabel Profil Korporasi Mitra ESG ──────────────────────
CREATE TABLE IF NOT EXISTS corporate_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  domain TEXT, -- contoh: 'pertamina.com' atau 'astra.co.id'
  briga_coin_pool INTEGER NOT NULL DEFAULT 0 CHECK (briga_coin_pool >= 0),
  min_per_employee INTEGER NOT NULL DEFAULT 5 CHECK (min_per_employee >= 5),
  contact_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_corp_profiles_domain 
  ON corporate_profiles (LOWER(domain)) 
  WHERE domain IS NOT NULL AND domain <> '';

ALTER TABLE corporate_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public read corporate profiles" ON corporate_profiles
    FOR SELECT TO authenticated, anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. Tabel Alokasi Kuota Komuter Karyawan ──────────────────
CREATE TABLE IF NOT EXISTS corporate_allowances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corporate_id UUID NOT NULL REFERENCES corporate_profiles(id) ON DELETE CASCADE,
  employee_email TEXT NOT NULL,
  amount_brc INTEGER NOT NULL CHECK (amount_brc >= 5),
  status TEXT NOT NULL DEFAULT 'allocated' 
    CHECK (status IN ('allocated', 'claimed', 'expired', 'revoked')),
  voucher_code TEXT UNIQUE,
  claimed_by_user_id UUID,
  claimed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corp_allowances_email 
  ON corporate_allowances (LOWER(employee_email));

CREATE INDEX IF NOT EXISTS idx_corp_allowances_voucher 
  ON corporate_allowances (voucher_code);

CREATE INDEX IF NOT EXISTS idx_corp_allowances_corp_status 
  ON corporate_allowances (corporate_id, status);

ALTER TABLE corporate_allowances ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Read own corporate allowance" ON corporate_allowances
    FOR SELECT TO authenticated 
    USING (
      LOWER(employee_email) = LOWER((SELECT auth.jwt() ->> 'email'))
      OR claimed_by_user_id = (SELECT auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. Tabel Log Telematika Emisi Scope 3 Mobil EV Korporat ──
CREATE TABLE IF NOT EXISTS corporate_emission_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corporate_id UUID NOT NULL REFERENCES corporate_profiles(id) ON DELETE CASCADE,
  trip_id TEXT,
  employee_email TEXT NOT NULL,
  distance_km NUMERIC(8,2) NOT NULL CHECK (distance_km >= 0),
  co2_saved_kg NUMERIC(8,2) NOT NULL CHECK (co2_saved_kg >= 0),
  brc_spent INTEGER NOT NULL DEFAULT 0 CHECK (brc_spent >= 0),
  vehicle_type TEXT DEFAULT 'EV_CAR',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corp_emissions_corp_id 
  ON corporate_emission_logs (corporate_id);

CREATE INDEX IF NOT EXISTS idx_corp_emissions_created_at 
  ON corporate_emission_logs (created_at DESC);

ALTER TABLE corporate_emission_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public read emission logs" ON corporate_emission_logs
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 4. Stored Procedure: claim_corporate_allowance ────────────
-- Mengklaim kuota komuter baik via pencocokan domain email saat login
-- ataupun input manual kode voucher promo perusahaan.
CREATE OR REPLACE FUNCTION claim_corporate_allowance(
  p_user_id UUID,
  p_email TEXT,
  p_voucher_code TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  claimed_amount INTEGER,
  voucher_code TEXT,
  company_name TEXT,
  error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_allowance RECORD;
  v_corp RECORD;
  v_user_email TEXT;
BEGIN
  v_user_email := LOWER(TRIM(p_email));

  -- 1. Klaim via kode voucher bila disediakan
  IF p_voucher_code IS NOT NULL AND TRIM(p_voucher_code) <> '' THEN
    SELECT a.*, c.company_name as corp_name
    INTO v_allowance
    FROM corporate_allowances a
    JOIN corporate_profiles c ON a.corporate_id = c.id
    WHERE UPPER(a.voucher_code) = UPPER(TRIM(p_voucher_code))
      AND a.status = 'allocated'
      AND (a.expires_at IS NULL OR a.expires_at > NOW())
    FOR UPDATE OF a;

    IF NOT FOUND THEN
      RETURN QUERY SELECT false, 0, p_voucher_code, ''::TEXT, 'VOUCHER_INVALID_OR_ALREADY_CLAIMED'::TEXT;
      RETURN;
    END IF;

  -- 2. Klaim via email domain matching
  ELSE
    SELECT a.*, c.company_name as corp_name
    INTO v_allowance
    FROM corporate_allowances a
    JOIN corporate_profiles c ON a.corporate_id = c.id
    WHERE (
      LOWER(a.employee_email) = v_user_email
      OR (
        c.domain IS NOT NULL 
        AND c.domain <> '' 
        AND v_user_email LIKE '%@' || LOWER(c.domain)
        AND a.employee_email = '*' -- Wildcard pool per domain
      )
    )
    AND a.status = 'allocated'
    AND (a.expires_at IS NULL OR a.expires_at > NOW())
    ORDER BY a.created_at ASC
    LIMIT 1
    FOR UPDATE OF a;

    IF NOT FOUND THEN
      RETURN QUERY SELECT false, 0, ''::TEXT, ''::TEXT, 'NO_PENDING_ALLOWANCE_FOUND'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Update status kuota menjadi claimed
  UPDATE corporate_allowances
  SET status = 'claimed',
      claimed_by_user_id = p_user_id,
      claimed_at = NOW()
  WHERE id = v_allowance.id;

  -- Kreditkan koin langsung ke saldo user
  -- Catatan: jika fungsi award_brc tersedia, panggil; jika tidak, update brigacoin_balances langsung
  BEGIN
    PERFORM award_brc(
      p_user_id,
      v_allowance.amount_brc,
      'corporate_allowance',
      'Subsidi Komuter Hijau dari ' || v_allowance.corp_name,
      'claim_allowance_' || v_allowance.id::TEXT,
      'claim_' || v_allowance.id::TEXT,
      'briga'
    );
  EXCEPTION WHEN OTHERS THEN
    -- Fallback ke tabel brigacoin_balances atau drivers
    INSERT INTO brigacoin_balances (user_id, balance, total_earned, total_spent, updated_at)
    VALUES (p_user_id, v_allowance.amount_brc, v_allowance.amount_brc, 0, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET balance = brigacoin_balances.balance + v_allowance.amount_brc,
        total_earned = brigacoin_balances.total_earned + v_allowance.amount_brc,
        updated_at = NOW();
  END;

  RETURN QUERY SELECT true, v_allowance.amount_brc, v_allowance.voucher_code, v_allowance.corp_name, ''::TEXT;
END;
$$;
