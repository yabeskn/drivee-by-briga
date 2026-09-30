-- ─────────────────────────────────────────────────────────────
-- 005_unified_brigacoin.sql — Unified BrigaCoin Ecosystem
--
-- Menyatukan BrigaCoin sebagai single source of truth lintas
-- aplikasi (Drifee PWA dan briga.id ecosystem).
--
-- Menambahkan:
-- 1. Tabel brigacoin_idempotency_keys (mencegah double crediting)
-- 2. Ekstensi tabel brigacoin_transactions (actor, external_ref, user_id)
-- 3. Tabel brigacoin_balances (saldo terpusat berbasis user_id / auth.uid)
-- 4. Tabel unified_identities (bridge user Drifee ↔ briga.id)
-- 5. Stored Procedures: award_brc & spend_brc (atomic, idempotent, SECURITY DEFINER)
-- 6. Trigger otomatis sync driver baru ke unified identity & balance
-- Semua operasi idempotent dan non-destructive.
-- ─────────────────────────────────────────────────────────────

-- ── 1. Ekstensi tabel brigacoin_transactions ─────────────────
ALTER TABLE brigacoin_transactions ALTER COLUMN driver_id DROP NOT NULL;
ALTER TABLE brigacoin_transactions ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE brigacoin_transactions ADD COLUMN IF NOT EXISTS actor VARCHAR(30) DEFAULT 'drifee'
  CHECK (actor IN ('drifee', 'briga', 'system', 'admin'));
ALTER TABLE brigacoin_transactions ADD COLUMN IF NOT EXISTS external_ref TEXT;

CREATE INDEX IF NOT EXISTS idx_brigacoin_user_id ON brigacoin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_brigacoin_actor ON brigacoin_transactions(actor);
CREATE INDEX IF NOT EXISTS idx_brigacoin_external_ref ON brigacoin_transactions(external_ref);

-- ── 2. Tabel Idempotency Keys ────────────────────────────────
CREATE TABLE IF NOT EXISTS brigacoin_idempotency_keys (
  key TEXT PRIMARY KEY,
  ledger_id UUID NOT NULL REFERENCES brigacoin_transactions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idempotency_ledger_id ON brigacoin_idempotency_keys(ledger_id);
ALTER TABLE brigacoin_idempotency_keys ENABLE ROW LEVEL SECURITY;

-- ── 3. Tabel Saldo Terpusat (brigacoin_balances) ─────────────
CREATE TABLE IF NOT EXISTS brigacoin_balances (
  user_id UUID PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_earned INTEGER NOT NULL DEFAULT 0 CHECK (total_earned >= 0),
  total_spent INTEGER NOT NULL DEFAULT 0 CHECK (total_spent >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE brigacoin_balances ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Read own balance" ON brigacoin_balances
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill data saldo dari tabel drivers yang sudah ada
INSERT INTO brigacoin_balances (user_id, balance, total_earned, total_spent, updated_at)
SELECT id, COALESCE(briga_coin_balance, 0), COALESCE(briga_coin_balance, 0), 0, NOW()
FROM drivers
ON CONFLICT (user_id) DO NOTHING;

-- ── 4. Tabel Unified Identities (Drifee ↔ briga.id) ──────────
CREATE TABLE IF NOT EXISTS unified_identities (
  user_id UUID PRIMARY KEY,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  briga_user_id TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unified_driver_id ON unified_identities(driver_id);
CREATE INDEX IF NOT EXISTS idx_unified_briga_user_id ON unified_identities(briga_user_id);

ALTER TABLE unified_identities ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Read own identity" ON unified_identities
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill data identity dari drivers yang ada
INSERT INTO unified_identities (user_id, driver_id, email, created_at, updated_at)
SELECT id, id, email, NOW(), NOW()
FROM drivers
ON CONFLICT (user_id) DO NOTHING;

-- ── 5. Trigger Otomatis Sync Driver Baru ─────────────────────
CREATE OR REPLACE FUNCTION trg_sync_driver_unified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO brigacoin_balances (user_id, balance, total_earned, total_spent, updated_at)
  VALUES (NEW.id, COALESCE(NEW.briga_coin_balance, 0), COALESCE(NEW.briga_coin_balance, 0), 0, NOW())
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO unified_identities (user_id, driver_id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.id, NEW.email, NOW(), NOW())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_driver_unified_sync ON drivers;
CREATE TRIGGER trg_driver_unified_sync
  AFTER INSERT ON drivers
  FOR EACH ROW
  EXECUTE FUNCTION trg_sync_driver_unified();

-- ── 6. Stored Procedure: award_brc (Atomic & Idempotent) ─────
CREATE OR REPLACE FUNCTION award_brc(
  p_user_id UUID,
  p_amount INTEGER,
  p_source VARCHAR,
  p_description TEXT,
  p_idempotency_key TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL,
  p_actor VARCHAR DEFAULT 'drifee',
  p_driver_id UUID DEFAULT NULL,
  p_external_ref TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  duplicate BOOLEAN,
  ledger_id UUID,
  balance INTEGER,
  total_earned INTEGER,
  total_spent INTEGER,
  error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_ledger_id UUID;
  v_balance INTEGER;
  v_earned INTEGER;
  v_spent INTEGER;
  v_ledger_id UUID;
  v_driver_id UUID := p_driver_id;
  v_trip_uuid UUID := NULL;
BEGIN
  -- Otorisasi: jika dipanggil authenticated user, hanya boleh kredit ke akunnya sendiri
  IF current_user != 'service_role' AND auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RETURN QUERY SELECT FALSE, FALSE, NULL::UUID, 0, 0, 0, 'UNAUTHORIZED: Cannot mutate another user balance'::TEXT;
    RETURN;
  END IF;

  -- 1. Validasi jumlah
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT FALSE, FALSE, NULL::UUID, 0, 0, 0, 'Amount must be positive'::TEXT;
    RETURN;
  END IF;

  -- 2. Cek idempotency
  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    SELECT ledger_id INTO v_existing_ledger_id
    FROM brigacoin_idempotency_keys
    WHERE key = p_idempotency_key;

    IF FOUND THEN
      SELECT b.balance, b.total_earned, b.total_spent
      INTO v_balance, v_earned, v_spent
      FROM brigacoin_balances b
      WHERE b.user_id = p_user_id;

      RETURN QUERY SELECT TRUE, TRUE, v_existing_ledger_id, COALESCE(v_balance, 0), COALESCE(v_earned, 0), COALESCE(v_spent, 0), NULL::TEXT;
      RETURN;
    END IF;
  END IF;

  -- 3. Cari driver_id jika belum diisi
  IF v_driver_id IS NULL THEN
    SELECT id INTO v_driver_id FROM drivers WHERE id = p_user_id;
  END IF;

  -- 4. Parse reference_id jika format UUID untuk trip_id
  IF p_reference_id IS NOT NULL AND p_reference_id ~ '^[0-9a-fA-F-]{36}$' THEN
    v_trip_uuid := p_reference_id::UUID;
  END IF;

  -- 5. Atomic Upsert ke brigacoin_balances
  INSERT INTO brigacoin_balances (user_id, balance, total_earned, total_spent, updated_at)
  VALUES (p_user_id, p_amount, p_amount, 0, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET balance = brigacoin_balances.balance + p_amount,
      total_earned = brigacoin_balances.total_earned + p_amount,
      updated_at = NOW()
  RETURNING brigacoin_balances.balance, brigacoin_balances.total_earned, brigacoin_balances.total_spent
  INTO v_balance, v_earned, v_spent;

  -- 6. Insert ke ledger brigacoin_transactions
  INSERT INTO brigacoin_transactions (
    driver_id, user_id, trip_id, type, amount, balance_after,
    source, description, actor, external_ref, created_at
  )
  VALUES (
    v_driver_id, p_user_id, v_trip_uuid, 'earn', p_amount, v_balance,
    p_source, p_description, COALESCE(p_actor, 'drifee'), p_external_ref, NOW()
  )
  RETURNING id INTO v_ledger_id;

  -- 7. Catat idempotency key
  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    INSERT INTO brigacoin_idempotency_keys (key, ledger_id, created_at)
    VALUES (p_idempotency_key, v_ledger_id, NOW())
    ON CONFLICT (key) DO NOTHING;
  END IF;

  -- 8. Sinkronkan kolom legacy drivers.briga_coin_balance
  IF v_driver_id IS NOT NULL THEN
    UPDATE drivers
    SET briga_coin_balance = v_balance,
        updated_at = NOW()
    WHERE id = v_driver_id;
  END IF;

  RETURN QUERY SELECT TRUE, FALSE, v_ledger_id, v_balance, v_earned, v_spent, NULL::TEXT;
END;
$$;

-- ── 7. Stored Procedure: spend_brc (Atomic, Idempotent, Safe) 
CREATE OR REPLACE FUNCTION spend_brc(
  p_user_id UUID,
  p_amount INTEGER,
  p_source VARCHAR,
  p_description TEXT,
  p_idempotency_key TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL,
  p_actor VARCHAR DEFAULT 'drifee',
  p_driver_id UUID DEFAULT NULL,
  p_external_ref TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  duplicate BOOLEAN,
  ledger_id UUID,
  balance INTEGER,
  total_earned INTEGER,
  total_spent INTEGER,
  error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_ledger_id UUID;
  v_balance INTEGER;
  v_earned INTEGER;
  v_spent INTEGER;
  v_ledger_id UUID;
  v_driver_id UUID := p_driver_id;
BEGIN
  -- Otorisasi
  IF current_user != 'service_role' AND auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RETURN QUERY SELECT FALSE, FALSE, NULL::UUID, 0, 0, 0, 'UNAUTHORIZED: Cannot mutate another user balance'::TEXT;
    RETURN;
  END IF;

  -- 1. Validasi input
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT FALSE, FALSE, NULL::UUID, 0, 0, 0, 'Amount must be positive'::TEXT;
    RETURN;
  END IF;

  -- 2. Cek idempotency
  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    SELECT ledger_id INTO v_existing_ledger_id
    FROM brigacoin_idempotency_keys
    WHERE key = p_idempotency_key;

    IF FOUND THEN
      SELECT b.balance, b.total_earned, b.total_spent
      INTO v_balance, v_earned, v_spent
      FROM brigacoin_balances b
      WHERE b.user_id = p_user_id;

      RETURN QUERY SELECT TRUE, TRUE, v_existing_ledger_id, COALESCE(v_balance, 0), COALESCE(v_earned, 0), COALESCE(v_spent, 0), NULL::TEXT;
      RETURN;
    END IF;
  END IF;

  -- 3. Cari driver_id jika belum diisi
  IF v_driver_id IS NULL THEN
    SELECT id INTO v_driver_id FROM drivers WHERE id = p_user_id;
  END IF;

  -- 4. Kunci baris saldo untuk atomic debit (SELECT FOR UPDATE)
  SELECT b.balance, b.total_earned, b.total_spent
  INTO v_balance, v_earned, v_spent
  FROM brigacoin_balances b
  WHERE b.user_id = p_user_id
  FOR UPDATE;

  -- Jika belum ada di brigacoin_balances, inisialisasi dari drivers
  IF NOT FOUND THEN
    IF v_driver_id IS NOT NULL THEN
      SELECT d.briga_coin_balance INTO v_balance FROM drivers d WHERE d.id = v_driver_id;
    END IF;

    IF v_balance IS NULL THEN
      v_balance := 0;
    END IF;

    INSERT INTO brigacoin_balances (user_id, balance, total_earned, total_spent, updated_at)
    VALUES (p_user_id, v_balance, v_balance, 0, NOW())
    ON CONFLICT (user_id) DO NOTHING;

    SELECT b.balance, b.total_earned, b.total_spent
    INTO v_balance, v_earned, v_spent
    FROM brigacoin_balances b
    WHERE b.user_id = p_user_id
    FOR UPDATE;
  END IF;

  -- 5. Cek kecukupan saldo
  IF v_balance < p_amount THEN
    RETURN QUERY SELECT FALSE, FALSE, NULL::UUID, v_balance, COALESCE(v_earned, 0), COALESCE(v_spent, 0), 'INSUFFICIENT_BALANCE'::TEXT;
    RETURN;
  END IF;

  -- 6. Update saldo
  UPDATE brigacoin_balances
  SET balance = balance - p_amount,
      total_spent = total_spent + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING balance, total_earned, total_spent
  INTO v_balance, v_earned, v_spent;

  -- 7. Insert ke ledger
  INSERT INTO brigacoin_transactions (
    driver_id, user_id, type, amount, balance_after,
    source, description, actor, external_ref, created_at
  )
  VALUES (
    v_driver_id, p_user_id, 'spend', -p_amount, v_balance,
    p_source, p_description, COALESCE(p_actor, 'drifee'), p_external_ref, NOW()
  )
  RETURNING id INTO v_ledger_id;

  -- 8. Catat idempotency key
  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    INSERT INTO brigacoin_idempotency_keys (key, ledger_id, created_at)
    VALUES (p_idempotency_key, v_ledger_id, NOW())
    ON CONFLICT (key) DO NOTHING;
  END IF;

  -- 9. Sinkronkan ke drivers
  IF v_driver_id IS NOT NULL THEN
    UPDATE drivers
    SET briga_coin_balance = v_balance,
        updated_at = NOW()
    WHERE id = v_driver_id;
  END IF;

  RETURN QUERY SELECT TRUE, FALSE, v_ledger_id, v_balance, v_earned, v_spent, NULL::TEXT;
END;
$$;

-- ── 8. Hak Akses Eksekusi (Privileges) ───────────────────────
REVOKE EXECUTE ON FUNCTION award_brc FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION spend_brc FROM PUBLIC;
GRANT EXECUTE ON FUNCTION award_brc TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION spend_brc TO authenticated, service_role;
