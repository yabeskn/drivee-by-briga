// ─────────────────────────────────────────────────────────────
// brigacoin/balance.ts — Server-Authoritative Unified BrigaCoin Ledger
//
// WS3 & Unified BrigaCoin (Fase A):
// Migrated from manual read-then-write to atomic DB functions
// `award_brc` and `spend_brc` (PL/pgSQL SECURITY DEFINER), with
// idempotency keys, single-source-of-truth balances, and fallback.
// ─────────────────────────────────────────────────────────────

import { supabaseAdmin, isAdminConfigured } from '@/lib/supabase/server';
import type { BrigaCoinBalance, BrigaCoinTransaction } from '@/types/telematics';

// ── Unified Constants ───────────────────────────────────────
export const BRC_TO_IDR = 5_000;          // 1 BRC = Rp 5.000
export const REWARD_FORMULA_VERSION = 1;  // bump bila formula berubah

export interface MutateOptions {
  idempotencyKey?: string;
  actor?: 'drifee' | 'briga' | 'system' | 'admin';
  externalRef?: string;
  userId?: string;
}

export interface SpendResult {
  success: boolean;
  balance?: BrigaCoinBalance;
  error?: string;
  duplicate?: boolean;
  ledgerId?: string;
}

export interface AwardResult {
  success: boolean;
  balance: BrigaCoinBalance;
  duplicate?: boolean;
  ledgerId?: string;
  error?: string;
}

// ── Fallback in-memory store (when Supabase not configured or in tests/offline) ──
const memBalanceStore = new Map<string, BrigaCoinBalance>();
const memTransactionStore = new Map<string, BrigaCoinTransaction[]>();
const memIdempotencyStore = new Map<string, { ledgerId: string; balance: BrigaCoinBalance }>();
let memDuplicateAttempts = 0;

function useSupabase(): boolean {
  return isAdminConfigured();
}

/** Helper to reset in-memory stores for tests */
export function _resetMemStore(): void {
  memBalanceStore.clear();
  memTransactionStore.clear();
  memIdempotencyStore.clear();
  memDuplicateAttempts = 0;
}

/** Helper to manually override memory balance for reconciliation/drift tests */
export function _setMemBalanceForTest(userId: string, balance: number): void {
  const existing = memBalanceStore.get(userId) ?? {
    driverId: userId,
    balance: 0,
    totalEarned: 0,
    totalSpent: 0,
    lastUpdated: new Date(),
  };
  memBalanceStore.set(userId, { ...existing, balance, lastUpdated: new Date() });
}

export function _getMemDuplicateAttempts(): number {
  return memDuplicateAttempts;
}

// ── In-Memory Execution Helpers ─────────────────────────────

function mutateMemoryAward(
  driverId: string,
  amount: number,
  source: BrigaCoinTransaction['source'],
  description: string,
  referenceId?: string,
  idempotencyKey?: string,
  options?: MutateOptions,
): AwardResult {
  if (idempotencyKey && memIdempotencyStore.has(idempotencyKey)) {
    memDuplicateAttempts++;
    const cached = memIdempotencyStore.get(idempotencyKey)!;
    return {
      success: true,
      duplicate: true,
      ledgerId: cached.ledgerId,
      balance: cached.balance,
    };
  }

  const existing = memBalanceStore.get(driverId) ?? {
    driverId,
    balance: 0,
    totalEarned: 0,
    totalSpent: 0,
    lastUpdated: new Date(),
  };

  const newBalance = existing.balance + amount;
  const ledgerId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const updated: BrigaCoinBalance = {
    driverId,
    balance: newBalance,
    totalEarned: existing.totalEarned + Math.max(0, amount),
    totalSpent: existing.totalSpent,
    lastUpdated: new Date(),
  };

  memBalanceStore.set(driverId, updated);

  const tx: BrigaCoinTransaction = {
    id: ledgerId,
    driverId,
    userId: options?.userId || driverId,
    type: 'earn',
    amount,
    balance: newBalance,
    source,
    referenceId,
    description,
    actor: options?.actor || 'drifee',
    externalRef: options?.externalRef,
    createdAt: new Date(),
  };

  const list = memTransactionStore.get(driverId) ?? [];
  list.push(tx);
  memTransactionStore.set(driverId, list);

  if (idempotencyKey) {
    memIdempotencyStore.set(idempotencyKey, { ledgerId, balance: updated });
  }

  return { success: true, duplicate: false, ledgerId, balance: updated };
}

function mutateMemorySpend(
  driverId: string,
  amount: number,
  source: BrigaCoinTransaction['source'],
  description: string,
  referenceId?: string,
  idempotencyKey?: string,
  options?: MutateOptions,
): SpendResult {
  if (idempotencyKey && memIdempotencyStore.has(idempotencyKey)) {
    memDuplicateAttempts++;
    const cached = memIdempotencyStore.get(idempotencyKey)!;
    return {
      success: true,
      duplicate: true,
      ledgerId: cached.ledgerId,
      balance: cached.balance,
    };
  }

  const existing = memBalanceStore.get(driverId) ?? {
    driverId,
    balance: 0,
    totalEarned: 0,
    totalSpent: 0,
    lastUpdated: new Date(),
  };

  const absAmount = Math.abs(amount);
  if (existing.balance < absAmount) {
    return { success: false, error: 'Insufficient balance' };
  }

  const newBalance = existing.balance - absAmount;
  const ledgerId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const updated: BrigaCoinBalance = {
    driverId,
    balance: newBalance,
    totalEarned: existing.totalEarned,
    totalSpent: existing.totalSpent + absAmount,
    lastUpdated: new Date(),
  };

  memBalanceStore.set(driverId, updated);

  const tx: BrigaCoinTransaction = {
    id: ledgerId,
    driverId,
    userId: options?.userId || driverId,
    type: 'spend',
    amount: -absAmount,
    balance: newBalance,
    source,
    referenceId,
    description,
    actor: options?.actor || 'drifee',
    externalRef: options?.externalRef,
    createdAt: new Date(),
  };

  const list = memTransactionStore.get(driverId) ?? [];
  list.push(tx);
  memTransactionStore.set(driverId, list);

  if (idempotencyKey) {
    memIdempotencyStore.set(idempotencyKey, { ledgerId, balance: updated });
  }

  return { success: true, duplicate: false, ledgerId, balance: updated };
}

/** Record adjustment directly into memory store */
export function mutateMemoryAdjust(
  userId: string,
  amount: number,
  description: string,
  actor: 'drifee' | 'briga' | 'system' | 'admin' = 'system',
): void {
  const existing = memBalanceStore.get(userId) ?? {
    driverId: userId,
    balance: 0,
    totalEarned: 0,
    totalSpent: 0,
    lastUpdated: new Date(),
  };

  const newBalance = existing.balance; // Balance is already at current snapshot
  const ledgerId = `txn_adj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const tx: BrigaCoinTransaction = {
    id: ledgerId,
    driverId: userId,
    userId,
    type: 'adjust',
    amount,
    balance: newBalance,
    source: 'adjustment',
    description,
    actor,
    createdAt: new Date(),
  };

  const list = memTransactionStore.get(userId) ?? [];
  list.push(tx);
  memTransactionStore.set(userId, list);
}

// ── Get Balance ─────────────────────────────────────────────

export async function getBalance(driverId: string): Promise<BrigaCoinBalance> {
  if (useSupabase()) {
    try {
      // 1. Coba baca dari tabel terpusat brigacoin_balances
      const { data: unifiedBalance } = await supabaseAdmin
        .from('brigacoin_balances')
        .select('user_id, balance, total_earned, total_spent, updated_at')
        .eq('user_id', driverId)
        .maybeSingle();

      if (unifiedBalance && typeof unifiedBalance.balance === 'number') {
        return {
          driverId,
          balance: unifiedBalance.balance,
          totalEarned: unifiedBalance.total_earned ?? 0,
          totalSpent: unifiedBalance.total_spent ?? 0,
          lastUpdated: new Date(unifiedBalance.updated_at),
        };
      }

      // 2. Fallback backward compatibility ke tabel drivers
      const { data: driver } = await supabaseAdmin
        .from('drivers')
        .select('id, briga_coin_balance, created_at, updated_at')
        .eq('id', driverId)
        .maybeSingle();

      if (driver && typeof driver.briga_coin_balance === 'number') {
        const { data: txns } = await supabaseAdmin
          .from('brigacoin_transactions')
          .select('amount')
          .or(`driver_id.eq.${driverId},user_id.eq.${driverId}`);

        const totalEarned = ((txns ?? []) as { amount: number }[])
          .filter((t) => t.amount > 0)
          .reduce((sum, t) => sum + t.amount, 0);
        const totalSpent = ((txns ?? []) as { amount: number }[])
          .filter((t) => t.amount < 0)
          .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        return {
          driverId,
          balance: driver.briga_coin_balance,
          totalEarned,
          totalSpent,
          lastUpdated: new Date(driver.updated_at),
        };
      }
    } catch {
      // Ignore error and fall through to memory
    }
  }

  // Fallback memory
  return (
    memBalanceStore.get(driverId) ?? {
      driverId,
      balance: 0,
      totalEarned: 0,
      totalSpent: 0,
      lastUpdated: new Date(),
    }
  );
}

// ── Add Balance (Atomic Credit / Award) ─────────────────────

export async function addBalance(
  driverId: string,
  amount: number,
  source: BrigaCoinTransaction['source'],
  description: string,
  referenceId?: string,
  options?: MutateOptions,
): Promise<BrigaCoinBalance> {
  const result = await awardBrigaCoins(driverId, amount, source, description, referenceId, options);
  return result.balance;
}

export async function awardBrigaCoins(
  driverId: string,
  amount: number,
  source: BrigaCoinTransaction['source'],
  description: string,
  referenceId?: string,
  options?: MutateOptions,
): Promise<AwardResult> {
  const idempotencyKey = options?.idempotencyKey || (referenceId ? `award:${referenceId}` : undefined);
  const userId = options?.userId || driverId;
  const actor = options?.actor || 'drifee';
  const externalRef = options?.externalRef;

  if (useSupabase()) {
    try {
      // Panggil fungsi DB atomik award_brc
      const { data, error } = await supabaseAdmin.rpc('award_brc', {
        p_user_id: userId,
        p_amount: Math.abs(amount),
        p_source: source,
        p_description: description,
        p_idempotency_key: idempotencyKey ?? null,
        p_reference_id: referenceId ?? null,
        p_actor: actor,
        p_driver_id: driverId,
        p_external_ref: externalRef ?? null,
      });

      if (!error && Array.isArray(data) && data.length > 0) {
        const row = data[0];
        if (row.success) {
          const balance: BrigaCoinBalance = {
            driverId,
            balance: row.balance,
            totalEarned: row.total_earned,
            totalSpent: row.total_spent,
            lastUpdated: new Date(),
          };
          return {
            success: true,
            duplicate: Boolean(row.duplicate),
            ledgerId: row.ledger_id,
            balance,
          };
        }
      }
    } catch {
      // Fall through to memory
    }
  }

  // Fallback to in-memory
  return mutateMemoryAward(driverId, amount, source, description, referenceId, idempotencyKey, options);
}

// ── Spend Balance (Atomic Debit) ─────────────────────────────

export async function spendBalance(
  driverId: string,
  amount: number,
  source: BrigaCoinTransaction['source'],
  description: string,
  referenceId?: string,
  options?: MutateOptions,
): Promise<SpendResult> {
  const absAmount = Math.abs(amount);
  const idempotencyKey = options?.idempotencyKey || (referenceId ? `redeem:${referenceId}` : undefined);
  const userId = options?.userId || driverId;
  const actor = options?.actor || 'drifee';
  const externalRef = options?.externalRef;

  if (useSupabase()) {
    try {
      const { data, error } = await supabaseAdmin.rpc('spend_brc', {
        p_user_id: userId,
        p_amount: absAmount,
        p_source: source,
        p_description: description,
        p_idempotency_key: idempotencyKey ?? null,
        p_reference_id: referenceId ?? null,
        p_actor: actor,
        p_driver_id: driverId,
        p_external_ref: externalRef ?? null,
      });

      if (!error && Array.isArray(data) && data.length > 0) {
        const row = data[0];
        if (!row.success) {
          return {
            success: false,
            error: row.error === 'INSUFFICIENT_BALANCE' ? 'Insufficient balance' : (row.error || 'Transaction failed'),
          };
        }

        const balance: BrigaCoinBalance = {
          driverId,
          balance: row.balance,
          totalEarned: row.total_earned,
          totalSpent: row.total_spent,
          lastUpdated: new Date(),
        };

        return {
          success: true,
          duplicate: Boolean(row.duplicate),
          ledgerId: row.ledger_id,
          balance,
        };
      }
    } catch {
      // Fall through to memory
    }
  }

  // Fallback to in-memory
  return mutateMemorySpend(driverId, absAmount, source, description, referenceId, idempotencyKey, options);
}

// ── Get Transactions ────────────────────────────────────────

export async function getTransactions(driverId: string): Promise<BrigaCoinTransaction[]> {
  if (useSupabase()) {
    try {
      const { data } = await supabaseAdmin
        .from('brigacoin_transactions')
        .select('*')
        .or(`driver_id.eq.${driverId},user_id.eq.${driverId}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data && data.length > 0) {
        return (data as Record<string, unknown>[]).map((row) => ({
          id: row.id as string,
          driverId: (row.driver_id as string) || (row.user_id as string) || driverId,
          userId: (row.user_id as string) || undefined,
          type: row.type as BrigaCoinTransaction['type'],
          amount: row.amount as number,
          balance: row.balance_after as number,
          source: row.source as BrigaCoinTransaction['source'],
          referenceId: (row.reference_id as string) ?? undefined,
          description: row.description as string,
          actor: (row.actor as BrigaCoinTransaction['actor']) || 'drifee',
          externalRef: (row.external_ref as string) || undefined,
          createdAt: new Date(row.created_at as string),
        }));
      }
    } catch {
      // Fall through to memory
    }
  }

  return memTransactionStore.get(driverId) ?? [];
}

// ── Get All Transactions (Cross-Ecosystem Ledger Stream) ────

export async function getAllTransactions(limit = 100): Promise<BrigaCoinTransaction[]> {
  if (useSupabase()) {
    try {
      const { data } = await supabaseAdmin
        .from('brigacoin_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (data && data.length > 0) {
        return (data as Record<string, unknown>[]).map((row) => ({
          id: row.id as string,
          driverId: (row.driver_id as string) || (row.user_id as string) || '',
          userId: (row.user_id as string) || undefined,
          type: row.type as BrigaCoinTransaction['type'],
          amount: row.amount as number,
          balance: row.balance_after as number,
          source: row.source as BrigaCoinTransaction['source'],
          referenceId: (row.reference_id as string) ?? undefined,
          description: row.description as string,
          actor: (row.actor as BrigaCoinTransaction['actor']) || 'drifee',
          externalRef: (row.external_ref as string) || undefined,
          createdAt: new Date(row.created_at as string),
        }));
      }
    } catch {
      // Fall through to memory
    }
  }

  const all: BrigaCoinTransaction[] = [];
  for (const list of memTransactionStore.values()) {
    all.push(...list);
  }
  return all
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

// ── Get Idempotency Stats ───────────────────────────────────

export async function getIdempotencyStats(): Promise<{ totalKeys: number; duplicateAttempts: number }> {
  let totalKeys = memIdempotencyStore.size;
  if (useSupabase()) {
    try {
      const { count } = await supabaseAdmin
        .from('brigacoin_idempotency_keys')
        .select('*', { count: 'exact', head: true });

      if (typeof count === 'number' && count > 0) {
        totalKeys = Math.max(totalKeys, count);
      }
    } catch {
      // Fall through to memory
    }
  }

  return {
    totalKeys,
    duplicateAttempts: memDuplicateAttempts,
  };
}

// ── Get All Balances (Admin / Rekonsiliasi) ──────────────────

export async function getAllBalances(): Promise<BrigaCoinBalance[]> {
  if (useSupabase()) {
    try {
      const { data } = await supabaseAdmin
        .from('brigacoin_balances')
        .select('user_id, balance, total_earned, total_spent, updated_at')
        .order('balance', { ascending: false });

      if (data && data.length > 0) {
        return (data as Record<string, unknown>[]).map((d) => ({
          driverId: d.user_id as string,
          balance: (d.balance as number) ?? 0,
          totalEarned: (d.total_earned as number) ?? 0,
          totalSpent: (d.total_spent as number) ?? 0,
          lastUpdated: new Date(d.updated_at as string),
        }));
      }

      // Fallback ke drivers
      const { data: drivers } = await supabaseAdmin
        .from('drivers')
        .select('id, briga_coin_balance, updated_at')
        .order('briga_coin_balance', { ascending: false });

      if (drivers && drivers.length > 0) {
        return (drivers as Record<string, unknown>[]).map((d) => ({
          driverId: d.id as string,
          balance: (d.briga_coin_balance as number) ?? 0,
          totalEarned: 0,
          totalSpent: 0,
          lastUpdated: new Date(d.updated_at as string),
        }));
      }
    } catch {
      // Fall through to memory
    }
  }

  return Array.from(memBalanceStore.values());
}
