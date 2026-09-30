// ─────────────────────────────────────────────────────────────
// brigacoin/reconciliation.ts — Ledger Reconciliation Engine
//
// Fase D: Observability & Integrity Auditing
// Compares snapshot balances in `brigacoin_balances` with the
// sum of immutable ledger entries in `brigacoin_transactions`.
// ─────────────────────────────────────────────────────────────

import { supabaseAdmin, isAdminConfigured } from '@/lib/supabase/server';
import { getBalance, getAllBalances, getTransactions } from './balance';

export interface UserReconciliationResult {
  userId: string;
  snapshotBalance: number;
  ledgerSum: number;
  drift: number;
  status: 'synced' | 'drift_detected';
  reconciledAt: string;
  fixed?: boolean;
}

export interface SystemReconciliationReport {
  timestamp: string;
  totalUsersAudited: number;
  syncedCount: number;
  driftCount: number;
  totalDriftAmount: number;
  discrepancies: UserReconciliationResult[];
}

export async function reconcileUserBalance(
  userId: string,
  autoFix = false
): Promise<UserReconciliationResult> {
  const current = await getBalance(userId);
  const txns = await getTransactions(userId);
  const ledgerSum = txns.reduce((sum, t) => sum + t.amount, 0);

  const drift = current.balance - ledgerSum;
  const status = drift === 0 ? 'synced' : 'drift_detected';
  let fixed = false;

  // Auto-fix if requested and drift is detected
  if (status === 'drift_detected' && autoFix) {
    try {
      if (isAdminConfigured()) {
        const adjustmentAmount = -drift;
        await (supabaseAdmin as unknown as {
          from: (table: string) => {
            insert: (values: Record<string, unknown>) => Promise<void>;
          };
        })
          .from('brigacoin_transactions')
          .insert({
            user_id: userId,
            driver_id: userId,
            type: 'adjust',
            amount: adjustmentAmount,
            balance_after: current.balance,
            source: 'adjustment',
            description: `Automated ledger reconciliation: realigned drift of ${drift} BRC`,
            actor: 'system',
          });
      }
      fixed = true;
    } catch (err) {
      console.error(`[Reconciliation] Failed to auto-fix drift for ${userId}:`, err);
    }
  }

  return {
    userId,
    snapshotBalance: current.balance,
    ledgerSum,
    drift,
    status,
    reconciledAt: new Date().toISOString(),
    fixed,
  };
}

export async function runSystemReconciliation(
  autoFix = false
): Promise<SystemReconciliationReport> {
  const all = await getAllBalances();
  const discrepancies: UserReconciliationResult[] = [];
  let syncedCount = 0;
  let driftCount = 0;
  let totalDriftAmount = 0;

  for (const item of all) {
    const res = await reconcileUserBalance(item.driverId, autoFix);
    if (res.status === 'drift_detected') {
      driftCount++;
      totalDriftAmount += Math.abs(res.drift);
      discrepancies.push(res);
    } else {
      syncedCount++;
    }
  }

  return {
    timestamp: new Date().toISOString(),
    totalUsersAudited: all.length,
    syncedCount,
    driftCount,
    totalDriftAmount,
    discrepancies,
  };
}
