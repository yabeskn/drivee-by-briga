/**
 * Tier 1: Feature Coverage — Unified BrigaCoin Ledger (Fase A)
 *
 * Requirements:
 * - 1 BRC = Rp 5.000 constant
 * - Single source of truth / append-only ledger
 * - Atomic award & spend with idempotency keys
 * - Double credit prevention on duplicate request
 * - Insufficient balance guard (no negative balance)
 * - Schema definitions for 005_unified_brigacoin.sql
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  getBalance,
  addBalance,
  awardBrigaCoins,
  spendBalance,
  _resetMemStore,
  BRC_TO_IDR,
  REWARD_FORMULA_VERSION,
} from '@/lib/brigacoin/balance';

describe('Tier 1: Feature Coverage — Unified BrigaCoin Ledger (Fase A)', () => {
  beforeEach(() => {
    _resetMemStore();
  });

  describe('1. Constants & Economics Contract', () => {
    it('1.1: should enforce 1 BRC = Rp 5.000 conversion constant', () => {
      expect(BRC_TO_IDR).toBe(5000);
    });

    it('1.2: should maintain reward formula version 1', () => {
      expect(REWARD_FORMULA_VERSION).toBe(1);
    });
  });

  describe('2. Atomic Award & Idempotency', () => {
    it('2.1: should award BrigaCoins and return updated balance', async () => {
      const driverId = 'driver-unified-001';
      const result = await awardBrigaCoins(
        driverId,
        150,
        'trip',
        'Trip reward TRP-101',
        'trip-101',
      );

      expect(result.success).toBe(true);
      expect(result.duplicate).toBe(false);
      expect(result.balance.balance).toBe(150);
      expect(result.balance.totalEarned).toBe(150);
      expect(result.ledgerId).toBeDefined();

      const current = await getBalance(driverId);
      expect(current.balance).toBe(150);
    });

    it('2.2: should be strictly idempotent: duplicate award request must NOT increase balance', async () => {
      const driverId = 'driver-unified-002';
      const idempotencyKey = 'award:trip-unique-abc';

      // First award
      const first = await awardBrigaCoins(
        driverId,
        200,
        'trip',
        'Trip reward',
        'trip-unique-abc',
        { idempotencyKey },
      );
      expect(first.success).toBe(true);
      expect(first.duplicate).toBe(false);
      expect(first.balance.balance).toBe(200);

      // Duplicate retry with same idempotency key
      const second = await awardBrigaCoins(
        driverId,
        200,
        'trip',
        'Trip reward retry',
        'trip-unique-abc',
        { idempotencyKey },
      );
      expect(second.success).toBe(true);
      expect(second.duplicate).toBe(true);
      expect(second.balance.balance).toBe(200); // Balance MUST remain 200, NOT 400!
      expect(second.ledgerId).toBe(first.ledgerId); // Retains original ledger id
    });

    it('2.3: should accumulate distinct awards correctly', async () => {
      const driverId = 'driver-unified-003';

      await addBalance(driverId, 100, 'trip', 'Trip 1');
      await addBalance(driverId, 50, 'bonus', 'Eco streak bonus');

      const balance = await getBalance(driverId);
      expect(balance.balance).toBe(150);
      expect(balance.totalEarned).toBe(150);
    });
  });

  describe('3. Spend & Balance Guard', () => {
    it('3.1: should debit balance when sufficient funds are available', async () => {
      const driverId = 'driver-spend-001';
      await addBalance(driverId, 300, 'trip', 'Initial grant');

      const spend = await spendBalance(
        driverId,
        100,
        'redemption',
        'Redeemed coffee voucher',
        'voucher-1',
      );

      expect(spend.success).toBe(true);
      expect(spend.balance?.balance).toBe(200);
      expect(spend.balance?.totalSpent).toBe(100);

      const current = await getBalance(driverId);
      expect(current.balance).toBe(200);
    });

    it('3.2: should reject spend when balance is insufficient (no negative balance)', async () => {
      const driverId = 'driver-spend-002';
      await addBalance(driverId, 50, 'trip', 'Small grant');

      const spend = await spendBalance(
        driverId,
        150,
        'redemption',
        'Expensive reward',
      );

      expect(spend.success).toBe(false);
      expect(spend.error).toBe('Insufficient balance');

      // Balance must remain unchanged
      const current = await getBalance(driverId);
      expect(current.balance).toBe(50);
      expect(current.totalSpent).toBe(0);
    });

    it('3.3: should be idempotent on spend operations with same key', async () => {
      const driverId = 'driver-spend-003';
      await addBalance(driverId, 500, 'trip', 'Initial deposit');

      const key = 'redeem:rdm-uuid-999';

      const first = await spendBalance(
        driverId,
        150,
        'redemption',
        'Redemption spend',
        'rdm-uuid-999',
        { idempotencyKey: key },
      );
      expect(first.success).toBe(true);
      expect(first.duplicate).toBe(false);
      expect(first.balance?.balance).toBe(350);

      // Replay request
      const second = await spendBalance(
        driverId,
        150,
        'redemption',
        'Redemption spend replay',
        'rdm-uuid-999',
        { idempotencyKey: key },
      );
      expect(second.success).toBe(true);
      expect(second.duplicate).toBe(true);
      expect(second.balance?.balance).toBe(350); // NOT deducted again
    });
  });

  describe('4. Database Migration 005_unified_brigacoin.sql Schema Integrity', () => {
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/005_unified_brigacoin.sql');

    it('4.1: should have migration file 005_unified_brigacoin.sql present', () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
    });

    it('4.2: should define brigacoin_balances table with check constraints and RLS', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toMatch(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?brigacoin_balances/i);
      expect(sql).toMatch(/balance\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0\s+CHECK\s+\(balance\s*>=\s*0\)/i);
      expect(sql).toMatch(/ALTER\s+TABLE\s+brigacoin_balances\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
      expect(sql).toMatch(/CREATE\s+POLICY\s+"Read own balance"\s+ON\s+brigacoin_balances/i);
    });

    it('4.3: should define brigacoin_idempotency_keys table', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toMatch(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?brigacoin_idempotency_keys/i);
      expect(sql).toMatch(/key\s+TEXT\s+PRIMARY\s+KEY/i);
      expect(sql).toMatch(/REFERENCES\s+brigacoin_transactions\(id\)/i);
    });

    it('4.4: should define unified_identities table for briga.id ecosystem integration', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toMatch(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?unified_identities/i);
      expect(sql).toMatch(/briga_user_id\s+TEXT/i);
      expect(sql).toMatch(/ALTER\s+TABLE\s+unified_identities\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
    });

    it('4.5: should define atomic stored procedures award_brc and spend_brc with SECURITY DEFINER and search_path', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+award_brc/i);
      expect(sql).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+spend_brc/i);
      expect(sql).toMatch(/SECURITY\s+DEFINER/i);
      expect(sql).toMatch(/SET\s+search_path\s*=\s*public,\s*pg_temp/i);
      expect(sql).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+award_brc\s+FROM\s+PUBLIC/i);
      expect(sql).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+spend_brc\s+FROM\s+PUBLIC/i);
    });
  });
});
