// ─────────────────────────────────────────────────────────────
// brigacoin/metrics.ts — Unified BrigaCoin Observability & Telemetry
//
// Fase D: Observability Engine
// Aggregates real-time metrics across all actors (drifee, briga, system, admin),
// tracks circulation volume, idempotency rates, and health drift.
// ─────────────────────────────────────────────────────────────

import {
  getAllBalances,
  getAllTransactions,
  getIdempotencyStats,
  BRC_TO_IDR,
} from './balance';
import { runSystemReconciliation } from './reconciliation';
import type { BrigaCoinTransaction } from '@/types/telematics';

export interface ActorMetrics {
  actor: 'drifee' | 'briga' | 'system' | 'admin';
  transactionCount: number;
  totalVolumeBrc: number;
  earnedBrc: number;
  spentBrc: number;
}

export interface BrigaCoinMetricsReport {
  timestamp: string;
  circulation: {
    totalBrc: number;
    totalIdr: number;
    totalEarnedBrc: number;
    totalSpentBrc: number;
    accountCount: number;
  };
  actors: Record<'drifee' | 'briga' | 'system' | 'admin', ActorMetrics>;
  sourceBreakdown: Record<string, { count: number; volumeBrc: number }>;
  idempotency: {
    totalKeys: number;
    duplicateAttempts: number;
    duplicateInterceptionRate: number; // percentage (0 - 100)
  };
  health: {
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    lastAuditTimestamp: string;
    syncedAccounts: number;
    driftAccounts: number;
    totalDriftBrc: number;
  };
  recentTransactions: Array<{
    id: string;
    userId: string;
    actor: 'drifee' | 'briga' | 'system' | 'admin';
    type: BrigaCoinTransaction['type'];
    amount: number;
    amountIdr: number;
    balance: number;
    source: string;
    description: string;
    createdAt: string;
  }>;
}

export async function getBrigaCoinMetrics(): Promise<BrigaCoinMetricsReport> {
  const [balances, transactions, idempStats, auditReport] = await Promise.all([
    getAllBalances(),
    getAllTransactions(100),
    getIdempotencyStats(),
    runSystemReconciliation(false),
  ]);

  // 1. Circulation Aggregation
  let totalBrc = 0;
  let totalEarnedBrc = 0;
  let totalSpentBrc = 0;

  for (const b of balances) {
    totalBrc += b.balance;
    totalEarnedBrc += b.totalEarned;
    totalSpentBrc += b.totalSpent;
  }

  // 2. Actor Breakdown Initialization
  const actors: Record<'drifee' | 'briga' | 'system' | 'admin', ActorMetrics> = {
    drifee: { actor: 'drifee', transactionCount: 0, totalVolumeBrc: 0, earnedBrc: 0, spentBrc: 0 },
    briga: { actor: 'briga', transactionCount: 0, totalVolumeBrc: 0, earnedBrc: 0, spentBrc: 0 },
    system: { actor: 'system', transactionCount: 0, totalVolumeBrc: 0, earnedBrc: 0, spentBrc: 0 },
    admin: { actor: 'admin', transactionCount: 0, totalVolumeBrc: 0, earnedBrc: 0, spentBrc: 0 },
  };

  const sourceBreakdown: Record<string, { count: number; volumeBrc: number }> = {};

  for (const tx of transactions) {
    const actorKey = (tx.actor && actors[tx.actor]) ? tx.actor : 'drifee';
    const entry = actors[actorKey];
    entry.transactionCount++;
    entry.totalVolumeBrc += Math.abs(tx.amount);

    if (tx.amount > 0) {
      entry.earnedBrc += tx.amount;
    } else {
      entry.spentBrc += Math.abs(tx.amount);
    }

    const src = tx.source || 'unknown';
    if (!sourceBreakdown[src]) {
      sourceBreakdown[src] = { count: 0, volumeBrc: 0 };
    }
    sourceBreakdown[src].count++;
    sourceBreakdown[src].volumeBrc += Math.abs(tx.amount);
  }

  // 3. Idempotency Calculation
  const totalOperations = transactions.length + idempStats.duplicateAttempts;
  const duplicateInterceptionRate =
    totalOperations > 0
      ? Number(((idempStats.duplicateAttempts / totalOperations) * 100).toFixed(2))
      : 0;

  // 4. Health Status
  let healthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
  if (auditReport.driftCount > 0) {
    healthStatus = auditReport.totalDriftAmount > 1000 ? 'CRITICAL' : 'WARNING';
  }

  // 5. Recent transactions
  const recent = transactions.slice(0, 15).map((t) => ({
    id: t.id,
    userId: t.userId || t.driverId,
    actor: t.actor || 'drifee',
    type: t.type,
    amount: t.amount,
    amountIdr: Math.abs(t.amount) * BRC_TO_IDR,
    balance: t.balance,
    source: t.source,
    description: t.description,
    createdAt: t.createdAt.toISOString(),
  }));

  return {
    timestamp: new Date().toISOString(),
    circulation: {
      totalBrc,
      totalIdr: totalBrc * BRC_TO_IDR,
      totalEarnedBrc,
      totalSpentBrc,
      accountCount: balances.length,
    },
    actors,
    sourceBreakdown,
    idempotency: {
      totalKeys: idempStats.totalKeys,
      duplicateAttempts: idempStats.duplicateAttempts,
      duplicateInterceptionRate,
    },
    health: {
      status: healthStatus,
      lastAuditTimestamp: auditReport.timestamp,
      syncedAccounts: auditReport.syncedCount,
      driftAccounts: auditReport.driftCount,
      totalDriftBrc: auditReport.totalDriftAmount,
    },
    recentTransactions: recent,
  };
}
