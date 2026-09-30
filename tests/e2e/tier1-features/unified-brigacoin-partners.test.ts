/**
 * Tier 1: Feature Coverage — Partner Integration & Hybrid Catalog (Fase C)
 *
 * Requirements:
 * - Partner reward catalog synchronization (POST /api/brigacoin/v1/partners/sync-rewards)
 * - Partner marketplace redemption (POST /api/brigacoin/v1/partners/redeem)
 * - Sufficient balance check & out of stock handling
 * - Single source of truth ledger debit
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as syncRewardsRoute } from '@/app/api/brigacoin/v1/partners/sync-rewards/route';
import { POST as redeemRoute } from '@/app/api/brigacoin/v1/partners/redeem/route';
import { awardBrigaCoins, _resetMemStore } from '@/lib/brigacoin/balance';

describe('Tier 1: Feature Coverage — Partner Integration & Hybrid Catalog (Fase C)', () => {
  const serviceKey = 'test-service-key-briga';
  const userId = 'user-partner-test-01';

  beforeEach(() => {
    _resetMemStore();
  });

  describe('1. POST /api/brigacoin/v1/partners/sync-rewards', () => {
    it('1.1: should require authorization header', async () => {
      const req = new NextRequest('http://localhost/api/brigacoin/v1/partners/sync-rewards', {
        method: 'POST',
        body: JSON.stringify({ items: [] }),
      });
      const res = await syncRewardsRoute(req);
      expect(res.status).toBe(401);
    });

    it('1.2: should reject invalid items array with 400', async () => {
      const req = new NextRequest('http://localhost/api/brigacoin/v1/partners/sync-rewards', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${serviceKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ items: 'not-an-array' }),
      });
      const res = await syncRewardsRoute(req);
      expect(res.status).toBe(400);
    });

    it('1.3: should successfully accept and sync valid partner catalog items', async () => {
      const items = [
        {
          name: 'Partner EV Supercharge 20kWh',
          description: 'Voucher pengisian daya supercepat',
          category: 'transport',
          cost: 150,
          stock: 25,
          partner_id: 'partner-uuid-001',
        },
        {
          name: 'Partner Kopi Kenangan Voucher Rp 25.000',
          category: 'voucher',
          cost: 50,
          stock: 100,
        },
      ];

      const req = new NextRequest('http://localhost/api/brigacoin/v1/partners/sync-rewards', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${serviceKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ items }),
      });

      const res = await syncRewardsRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.synced_count).toBe(2);
    });
  });

  describe('2. POST /api/brigacoin/v1/partners/redeem', () => {
    it('2.1: should reject redemption when balance is insufficient (409)', async () => {
      // User has 0 balance initially
      const req = new NextRequest('http://localhost/api/brigacoin/v1/partners/redeem', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${serviceKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          reward_id: 'ext_001',
        }),
      });

      const res = await redeemRoute(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('INSUFFICIENT_BALANCE');
    });

    it('2.2: should process redemption and issue voucher code when user has balance', async () => {
      // First deposit 500 BRC
      await awardBrigaCoins(userId, 500, 'bonus', 'Initial test deposit');

      const req = new NextRequest('http://localhost/api/brigacoin/v1/partners/redeem', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${serviceKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          reward_id: 'ext_001',
          delivery_method: 'email',
        }),
      });

      const res = await redeemRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.voucher_code).toMatch(/^BRC-[A-Z0-9]+-[A-Z0-9]+$/);
      expect(json.data.cost).toBeGreaterThan(0);
      expect(json.data.balance).toBe(500 - json.data.cost);
      expect(json.data.expires_at).toBeDefined();
    });
  });
});
