/**
 * Tier 1: Feature Coverage — Unified BrigaCoin API & Security (Fase B)
 *
 * Requirements:
 * - Server-to-server endpoints: /api/brigacoin/v1/{balance, earn, spend, transactions}
 * - Bearer service token authentication (BRIGA_SERVICE_KEY, DRIFEE_SERVICE_KEY)
 * - Validation & error codes (400 INVALID_PAYLOAD, 401 Unauthorized, 409 INSUFFICIENT_BALANCE)
 * - Idempotency across earn and spend
 * - Webhook HMAC-SHA256 signature generation and verification
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getBalanceRoute } from '@/app/api/brigacoin/v1/balance/[userId]/route';
import { POST as earnRoute } from '@/app/api/brigacoin/v1/earn/route';
import { POST as spendRoute } from '@/app/api/brigacoin/v1/spend/route';
import { GET as getTransactionsRoute } from '@/app/api/brigacoin/v1/transactions/[userId]/route';
import { _resetMemStore } from '@/lib/brigacoin/balance';
import { generateWebhookSignature, verifyWebhookSignature } from '@/lib/brigacoin/webhooks';

describe('Tier 1: Feature Coverage — Unified BrigaCoin API & Security (Fase B)', () => {
  const validServiceKey = 'test-service-key-briga';
  const targetUser = 'user-unified-api-01';

  beforeEach(() => {
    _resetMemStore();
  });

  describe('1. Server-to-Server Authentication', () => {
    it('1.1: should reject requests without Authorization header with 401', async () => {
      const req = new NextRequest(`http://localhost/api/brigacoin/v1/balance/${targetUser}`);
      const res = await getBalanceRoute(req, { params: { userId: targetUser } });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Authorization/i);
    });

    it('1.2: should reject requests with invalid Bearer token with 401', async () => {
      const req = new NextRequest(`http://localhost/api/brigacoin/v1/balance/${targetUser}`, {
        headers: {
          authorization: 'Bearer wrong-service-key',
        },
      });
      const res = await getBalanceRoute(req, { params: { userId: targetUser } });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid service token');
    });

    it('1.3: should accept requests with valid Bearer token', async () => {
      const req = new NextRequest(`http://localhost/api/brigacoin/v1/balance/${targetUser}`, {
        headers: {
          authorization: `Bearer ${validServiceKey}`,
        },
      });
      const res = await getBalanceRoute(req, { params: { userId: targetUser } });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.user_id).toBe(targetUser);
      expect(json.data.balance).toBe(0);
    });
  });

  describe('2. POST /api/brigacoin/v1/earn', () => {
    it('2.1: should reject invalid payload with 400', async () => {
      const req = new NextRequest('http://localhost/api/brigacoin/v1/earn', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${validServiceKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          amount: -50, // invalid negative amount
        }),
      });

      const res = await earnRoute(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('2.2: should process valid earn request and update balance', async () => {
      const req = new NextRequest('http://localhost/api/brigacoin/v1/earn', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${validServiceKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          user_id: targetUser,
          amount: 250,
          source: 'trip_reward',
          description: 'Trip reward TRP-888',
          reference_id: 'trip-888',
        }),
      });

      const res = await earnRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.balance).toBe(250);
      expect(json.data.total_earned).toBe(250);
      expect(json.data.duplicate).toBe(false);
      expect(json.data.ledger_id).toBeDefined();
    });

    it('2.3: should enforce idempotency on repeated earn requests', async () => {
      const idempotencyKey = 'award:trip-idempotent-123';
      const payload = {
        user_id: targetUser,
        amount: 100,
        source: 'trip_reward',
        description: 'Idempotent trip reward',
        idempotency_key: idempotencyKey,
      };

      // Call 1
      const req1 = new NextRequest('http://localhost/api/brigacoin/v1/earn', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${validServiceKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const res1 = await earnRoute(req1);
      const json1 = await res1.json();
      expect(json1.data.balance).toBe(100);
      expect(json1.data.duplicate).toBe(false);

      // Call 2 (retry)
      const req2 = new NextRequest('http://localhost/api/brigacoin/v1/earn', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${validServiceKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const res2 = await earnRoute(req2);
      const json2 = await res2.json();
      expect(json2.data.balance).toBe(100); // DID NOT double credit to 200
      expect(json2.data.duplicate).toBe(true);
      expect(json2.data.ledger_id).toBe(json1.data.ledger_id);
    });
  });

  describe('3. POST /api/brigacoin/v1/spend', () => {
    it('3.1: should return 409 INSUFFICIENT_BALANCE when user lacks funds', async () => {
      const req = new NextRequest('http://localhost/api/brigacoin/v1/spend', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${validServiceKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          user_id: targetUser,
          amount: 500, // zero balance initially
          source: 'redemption',
          description: 'Voucher redemption',
        }),
      });

      const res = await spendRoute(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('INSUFFICIENT_BALANCE');
      expect(json.balance).toBe(0);
    });

    it('3.2: should deduct coins on valid spend and record transaction', async () => {
      // First deposit funds
      const earnReq = new NextRequest('http://localhost/api/brigacoin/v1/earn', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${validServiceKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          user_id: targetUser,
          amount: 300,
        }),
      });
      await earnRoute(earnReq);

      // Spend 120
      const spendReq = new NextRequest('http://localhost/api/brigacoin/v1/spend', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${validServiceKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          user_id: targetUser,
          amount: 120,
          source: 'redemption',
          description: 'EV Charging Voucher',
          reference_id: 'voucher-ev-01',
        }),
      });

      const spendRes = await spendRoute(spendReq);
      expect(spendRes.status).toBe(200);
      const json = await spendRes.json();
      expect(json.success).toBe(true);
      expect(json.data.balance).toBe(180);
      expect(json.data.total_spent).toBe(120);
      expect(json.data.duplicate).toBe(false);
    });
  });

  describe('4. GET /api/brigacoin/v1/transactions/[userId]', () => {
    it('4.1: should return paginated transaction history items', async () => {
      // Create some activity
      const earnReq = new NextRequest('http://localhost/api/brigacoin/v1/earn', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${validServiceKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          user_id: targetUser,
          amount: 50,
          description: 'Test transaction item',
        }),
      });
      await earnRoute(earnReq);

      const req = new NextRequest(`http://localhost/api/brigacoin/v1/transactions/${targetUser}`, {
        headers: {
          authorization: `Bearer ${validServiceKey}`,
        },
      });

      const res = await getTransactionsRoute(req, { params: { userId: targetUser } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data.items)).toBe(true);
      expect(json.data.items.length).toBeGreaterThan(0);
      expect(json.data.items[0].description).toBe('Test transaction item');
    });
  });

  describe('5. Webhook HMAC-SHA256 Signatures', () => {
    const testSecret = 'super-secret-key-12345';
    const body = JSON.stringify({ event: 'brigacoin.earned', user_id: 'u1', amount: 100 });

    it('5.1: should generate signature formatted as sha256=<hex>', () => {
      const sig = generateWebhookSignature(body, testSecret);
      expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    it('5.2: should accurately verify valid signature', () => {
      const sig = generateWebhookSignature(body, testSecret);
      expect(verifyWebhookSignature(body, sig, testSecret)).toBe(true);
    });

    it('5.3: should reject tampered body or incorrect secret', () => {
      const sig = generateWebhookSignature(body, testSecret);
      const tamperedBody = JSON.stringify({ event: 'brigacoin.earned', user_id: 'u1', amount: 99999 });

      expect(verifyWebhookSignature(tamperedBody, sig, testSecret)).toBe(false);
      expect(verifyWebhookSignature(body, sig, 'wrong-secret')).toBe(false);
    });
  });
});
