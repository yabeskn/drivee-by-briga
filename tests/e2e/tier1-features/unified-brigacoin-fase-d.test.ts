/**
 * Tier 1: Feature Coverage — Unified BrigaCoin Fase D: Observability & Automated Reconciliation
 *
 * Requirements:
 * - Automated Cron endpoint (/api/cron/reconcile-brigacoin) protected by CRON_SECRET / service key
 * - Zero-drift audit detection & Sentry alert trigger
 * - Auto-fix capabilities restoring ledger alignment
 * - Observability metrics (/api/admin/brigacoin/metrics) with actor breakdown & circulation
 * - Fixed economic conversion (1 BRC = Rp 5.000)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  awardBrigaCoins,
  spendBalance,
  _resetMemStore,
  _setMemBalanceForTest,
  BRC_TO_IDR,
} from '@/lib/brigacoin/balance';
import {
  reconcileUserBalance,
  runSystemReconciliation,
} from '@/lib/brigacoin/reconciliation';
import { getBrigaCoinMetrics } from '@/lib/brigacoin/metrics';
import { GET as cronGet, POST as cronPost } from '@/app/api/cron/reconcile-brigacoin/route';
import { GET as metricsGet } from '@/app/api/admin/brigacoin/metrics/route';

describe('Tier 1: Feature Coverage — Fase D: Observability & Automated Reconciliation', () => {
  const adminSecret = 'drifee-internal-secret-key-prod-2026';
  const cronSecret = 'test-cron-secret-2026';

  beforeEach(() => {
    _resetMemStore();
    process.env.CRON_SECRET = cronSecret;
    process.env.ADMIN_SERVICE_KEY = adminSecret;
    process.env.DRIFEE_SERVICE_KEY = adminSecret;
  });

  describe('1. Daily Reconciliation Cron Endpoint (/api/cron/reconcile-brigacoin)', () => {
    it('1.1: should reject unauthorized request without CRON_SECRET or service key', async () => {
      const req = new NextRequest('http://localhost:3000/api/cron/reconcile-brigacoin', {
        headers: { Authorization: 'Bearer invalid-token' },
      });
      const res = await cronGet(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/unauthorized/i);
    });

    it('1.2: should accept request with valid CRON_SECRET in Authorization header', async () => {
      const req = new NextRequest('http://localhost:3000/api/cron/reconcile-brigacoin', {
        headers: { Authorization: `Bearer ${cronSecret}` },
      });
      const res = await cronGet(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.job).toBe('reconcile-brigacoin');
      expect(json.report).toBeDefined();
      expect(json.report.driftCount).toBe(0);
    });

    it('1.3: should accept request with x-cron-secret header', async () => {
      const req = new NextRequest('http://localhost:3000/api/cron/reconcile-brigacoin', {
        headers: { 'x-cron-secret': cronSecret },
      });
      const res = await cronGet(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it('1.4: should accept POST request with auto_fix param', async () => {
      const req = new NextRequest('http://localhost:3000/api/cron/reconcile-brigacoin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cronSecret}`,
        },
        body: JSON.stringify({ auto_fix: true }),
      });
      const res = await cronPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.report).toBeDefined();
    });
  });

  describe('2. Drift Detection, Sentry Alert & Auto-Fix', () => {
    const testUser = 'user-drift-audit-01';

    it('2.1: should detect intentional balance drift and trigger alert', async () => {
      // Step 1: Create legitimate balance of 100 BRC
      await awardBrigaCoins(testUser, 100, 'trip', 'Trip reward', undefined, { actor: 'drifee' });

      // Step 2: Induce drift artificially (e.g. out-of-band manipulation or data race)
      _setMemBalanceForTest(testUser, 160); // 60 BRC higher than ledger sum

      // Step 3: Audit balance
      const audit = await reconcileUserBalance(testUser, false);
      expect(audit.status).toBe('drift_detected');
      expect(audit.snapshotBalance).toBe(160);
      expect(audit.ledgerSum).toBe(100);
      expect(audit.drift).toBe(60);

      // Step 4: System audit confirms drift and triggers alert
      const sysAudit = await runSystemReconciliation(false);
      expect(sysAudit.driftCount).toBeGreaterThanOrEqual(1);
      expect(sysAudit.alertTriggered).toBe(true);
      expect(sysAudit.totalDriftAmount).toBeGreaterThanOrEqual(60);
    });

    it('2.2: should automatically fix drift and restore zero-drift status', async () => {
      const autoFixUser = 'user-drift-autofix-02';
      await awardBrigaCoins(autoFixUser, 200, 'trip', 'Trip reward', undefined, { actor: 'drifee' });

      // Induce 40 BRC drift
      _setMemBalanceForTest(autoFixUser, 240);

      // Verify drift exists
      const beforeFix = await reconcileUserBalance(autoFixUser, false);
      expect(beforeFix.status).toBe('drift_detected');

      // Execute auto-fix
      const fixedResult = await reconcileUserBalance(autoFixUser, true);
      expect(fixedResult.fixed).toBe(true);

      // Re-audit confirms zero drift
      const afterFix = await reconcileUserBalance(autoFixUser, false);
      expect(afterFix.status).toBe('synced');
      expect(afterFix.drift).toBe(0);
      expect(afterFix.snapshotBalance).toBe(240);
      expect(afterFix.ledgerSum).toBe(240);
    });
  });

  describe('3. Observability Metrics & Cross-Actor Telemetry', () => {
    it('3.1: should compute circulation, actor breakdown, and IDR conversion correctly', async () => {
      // Driver earns 300 BRC via Drifee
      await awardBrigaCoins('driver-1', 300, 'trip', 'Jabodetabek trip', 'ref-01', {
        actor: 'drifee',
      });

      // User spends 50 BRC via Briga.id marketplace
      await spendBalance('driver-1', 50, 'redemption', 'Briga voucher', 'ref-02', {
        actor: 'briga',
      });

      // Another user earns 100 BRC via Drifee streak
      await awardBrigaCoins('driver-2', 100, 'bonus', 'Streak bonus', 'ref-03', {
        actor: 'drifee',
      });

      const metrics = await getBrigaCoinMetrics();

      // Circulation checks: total = (300 - 50) + 100 = 350 BRC
      expect(metrics.circulation.totalBrc).toBe(350);
      expect(metrics.circulation.totalIdr).toBe(350 * BRC_TO_IDR); // Rp 1.750.000
      expect(metrics.circulation.accountCount).toBe(2);

      // Actor breakdown checks
      expect(metrics.actors.drifee.transactionCount).toBe(2);
      expect(metrics.actors.drifee.earnedBrc).toBe(400); // 300 + 100
      expect(metrics.actors.briga.transactionCount).toBe(1);
      expect(metrics.actors.briga.spentBrc).toBe(50);

      // Health status check
      expect(metrics.health.status).toBe('HEALTHY');
      expect(metrics.health.driftAccounts).toBe(0);
    });

    it('3.2: should track duplicate key idempotency interception rate', async () => {
      const user = 'driver-idemp-track';
      const key = 'award:trip-dup-01';

      // First call (successful)
      const res1 = await awardBrigaCoins(user, 50, 'trip', 'Trip 1', undefined, {
        idempotencyKey: key,
      });
      expect(res1.duplicate).toBe(false);

      // Second call with same idempotency key (intercepted)
      const res2 = await awardBrigaCoins(user, 50, 'trip', 'Trip 1 retry', undefined, {
        idempotencyKey: key,
      });
      expect(res2.duplicate).toBe(true);

      const metrics = await getBrigaCoinMetrics();
      expect(metrics.idempotency.totalKeys).toBeGreaterThanOrEqual(1);
      expect(metrics.idempotency.duplicateAttempts).toBeGreaterThanOrEqual(1);
      expect(metrics.idempotency.duplicateInterceptionRate).toBeGreaterThan(0);
    });

    it('3.3: should serve metrics via GET /api/admin/brigacoin/metrics', async () => {
      // Unauthorized call
      const unauthReq = new NextRequest('http://localhost:3000/api/admin/brigacoin/metrics');
      const unauthRes = await metricsGet(unauthReq);
      expect(unauthRes.status).toBe(401);

      // Authorized call with admin service key
      const authReq = new NextRequest('http://localhost:3000/api/admin/brigacoin/metrics', {
        headers: { Authorization: `Bearer ${adminSecret}` },
      });
      const authRes = await metricsGet(authReq);
      expect(authRes.status).toBe(200);

      const json = await authRes.json();
      expect(json.success).toBe(true);
      expect(json.data.circulation).toBeDefined();
      expect(json.data.actors.drifee).toBeDefined();
      expect(json.data.actors.briga).toBeDefined();
      expect(json.data.health.status).toBe('HEALTHY');
    });
  });
});
