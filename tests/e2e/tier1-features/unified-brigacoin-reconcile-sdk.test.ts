/**
 * Tier 1: Feature Coverage — Reconciliation Engine & Client SDK (Fase C & D)
 *
 * Requirements:
 * - Ledger reconciliation compares snapshot balance with transaction ledger
 * - Drift detection and auto-fix capabilities
 * - Client SDK utility functions (BRC <-> IDR conversion, webhook validation)
 * - Trip verification uses awardBrigaCoins
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  addBalance,
  _resetMemStore,
} from '@/lib/brigacoin/balance';
import {
  reconcileUserBalance,
  runSystemReconciliation,
} from '@/lib/brigacoin/reconciliation';
import { UnifiedBrigaCoinSDK } from '@/lib/brigacoin/sdk';
import { generateWebhookSignature } from '@/lib/brigacoin/webhooks';

describe('Tier 1: Feature Coverage — Reconciliation Engine & Client SDK (Fase C & D)', () => {
  const userId = 'user-recon-test-01';

  beforeEach(() => {
    _resetMemStore();
  });

  describe('1. Reconciliation Engine (Fase D)', () => {
    it('1.1: should report synced status when balance matches ledger', async () => {
      await addBalance(userId, 200, 'trip', 'Trip credit');
      const res = await reconcileUserBalance(userId);

      expect(res.userId).toBe(userId);
      expect(res.snapshotBalance).toBe(200);
      expect(res.status).toBe('synced');
      expect(res.drift).toBe(0);
    });

    it('1.2: should run system-wide reconciliation without errors', async () => {
      await addBalance('user-recon-02', 150, 'bonus', 'Bonus credit');
      await addBalance('user-recon-03', 300, 'trip', 'Trip credit');

      const report = await runSystemReconciliation(false);
      expect(report.totalUsersAudited).toBeGreaterThanOrEqual(2);
      expect(report.syncedCount).toBeGreaterThanOrEqual(2);
      expect(report.driftCount).toBe(0);
      expect(report.totalDriftAmount).toBe(0);
    });
  });

  describe('2. Client SDK (Fase C)', () => {
    it('2.1: should accurately convert between BRC and IDR at 1 BRC = Rp 5.000', () => {
      expect(UnifiedBrigaCoinSDK.convertToIdr(1)).toBe(5000);
      expect(UnifiedBrigaCoinSDK.convertToIdr(10)).toBe(50000);
      expect(UnifiedBrigaCoinSDK.convertToIdr(250)).toBe(1250000);

      expect(UnifiedBrigaCoinSDK.convertToBrc(5000)).toBe(1);
      expect(UnifiedBrigaCoinSDK.convertToBrc(50000)).toBe(10);
      expect(UnifiedBrigaCoinSDK.convertToBrc(1250000)).toBe(250);
      // Floor rounding for fractional BRC amounts
      expect(UnifiedBrigaCoinSDK.convertToBrc(12000)).toBe(2);
    });

    it('2.2: should verify webhook signatures correctly using SDK', () => {
      const secret = 'webhook-test-secret-999';
      const sdk = new UnifiedBrigaCoinSDK({
        baseUrl: 'https://drifee.briga.id',
        serviceKey: 'svc-key',
        webhookSecret: secret,
      });

      const body = JSON.stringify({ event: 'brigacoin.earned', user: 'u1' });
      const signature = generateWebhookSignature(body, secret);

      expect(sdk.verifyWebhook(body, signature)).toBe(true);
      expect(sdk.verifyWebhook(body, 'sha256=invalidhash00000000000000000000000000000000000000000000000000000000')).toBe(false);
    });
  });
});
