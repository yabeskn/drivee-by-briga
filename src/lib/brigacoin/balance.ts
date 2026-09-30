// ─────────────────────────────────────────────────────────────
// brigacoin/balance.ts — Server-Authoritative BrigaCoin Ledger
//
// WS3: Migrated from in-memory Map<> to Supabase PostgreSQL.
// All balance operations now go through the database.
// ─────────────────────────────────────────────────────────────

import { supabaseAdmin, isAdminConfigured } from '@/lib/supabase/server';
import type { BrigaCoinBalance, BrigaCoinTransaction } from '@/types/telematics';

// ── Fallback in-memory store (when Supabase not configured) ──
const memBalanceStore = new Map<string, BrigaCoinBalance>();
const memTransactionStore = new Map<string, BrigaCoinTransaction[]>();

function useSupabase(): boolean {
  return isAdminConfigured();
}

// ── Get Balance ─────────────────────────────────────────────

export async function getBalance(driverId: string): Promise<BrigaCoinBalance> {
  if (useSupabase()) {
    const { data } = await supabaseAdmin
      .from('drivers')
      .select('id, briga_coin_balance, created_at, updated_at')
      .eq('id', driverId)
      .single();

    if (data) {
      // Compute totalEarned/totalSpent from transaction ledger
      const { data: txns } = await supabaseAdmin
        .from('brigacoin_transactions')
        .select('amount')
        .eq('driver_id', driverId);

      const totalEarned = ((txns ?? []) as { amount: number }[])
        .filter((t) => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
      const totalSpent = ((txns ?? []) as { amount: number }[])
        .filter((t) => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      return {
        driverId,
        balance: (data as { briga_coin_balance: number }).briga_coin_balance ?? 0,
        totalEarned,
        totalSpent,
        lastUpdated: new Date((data as { updated_at: string }).updated_at),
      };
    }
  }

  // Fallback
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

// ── Add Balance (credit or debit) ───────────────────────────

export async function addBalance(
  driverId: string,
  amount: number,
  source: BrigaCoinTransaction['source'],
  description: string,
  referenceId?: string,
): Promise<BrigaCoinBalance> {
  if (useSupabase()) {
    // 1. Get current balance
    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('briga_coin_balance')
      .eq('id', driverId)
      .single();

    const currentBalance = (driver as { briga_coin_balance: number } | null)?.briga_coin_balance ?? 0;
    const newBalance = currentBalance + amount;

    // 2. Update driver balance
    await (supabaseAdmin as unknown as {
      from: (table: string) => {
        update: (values: Record<string, unknown>) => { eq: (col: string, val: string) => Promise<void> };
      };
    })
      .from('drivers')
      .update({
        briga_coin_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', driverId);

    // 3. Insert transaction record
    await (supabaseAdmin as unknown as {
      from: (table: string) => {
        insert: (values: Record<string, unknown>) => Promise<void>;
      };
    })
      .from('brigacoin_transactions')
      .insert({
        driver_id: driverId,
        type: amount > 0 ? 'earn' : 'spend',
        amount,
        balance_after: newBalance,
        source,
        reference_id: referenceId ?? null,
        description,
      });

    return getBalance(driverId);
  }

  // Fallback in-memory
  const balance = await getBalance(driverId);
  const newBalance = balance.balance + amount;

  const transaction: BrigaCoinTransaction = {
    id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    driverId,
    type: amount > 0 ? 'earn' : 'spend',
    amount,
    balance: newBalance,
    source,
    referenceId,
    description,
    createdAt: new Date(),
  };

  balance.balance = newBalance;
  balance.totalEarned += Math.max(0, amount);
  balance.totalSpent += Math.max(0, -amount);
  balance.lastUpdated = new Date();

  memBalanceStore.set(driverId, balance);

  const transactions = memTransactionStore.get(driverId) ?? [];
  transactions.push(transaction);
  memTransactionStore.set(driverId, transactions);

  return balance;
}

// ── Spend Balance ───────────────────────────────────────────

export async function spendBalance(
  driverId: string,
  amount: number,
  source: BrigaCoinTransaction['source'],
  description: string,
  referenceId?: string,
): Promise<{ success: boolean; balance?: BrigaCoinBalance; error?: string }> {
  const balance = await getBalance(driverId);

  if (balance.balance < amount) {
    return { success: false, error: 'Insufficient balance' };
  }

  const updated = await addBalance(driverId, -amount, source, description, referenceId);
  return { success: true, balance: updated };
}

// ── Get Transactions ────────────────────────────────────────

export async function getTransactions(driverId: string): Promise<BrigaCoinTransaction[]> {
  if (useSupabase()) {
    const { data } = await supabaseAdmin
      .from('brigacoin_transactions')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(50);

    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: row.id as string,
      driverId: row.driver_id as string,
      type: row.type as BrigaCoinTransaction['type'],
      amount: row.amount as number,
      balance: row.balance_after as number,
      source: row.source as BrigaCoinTransaction['source'],
      referenceId: (row.reference_id as string) ?? undefined,
      description: row.description as string,
      createdAt: new Date(row.created_at as string),
    }));
  }

  return memTransactionStore.get(driverId) ?? [];
}

// ── Get All Balances (Admin) ────────────────────────────────

export async function getAllBalances(): Promise<BrigaCoinBalance[]> {
  if (useSupabase()) {
    const { data } = await supabaseAdmin
      .from('drivers')
      .select('id, briga_coin_balance, updated_at')
      .order('briga_coin_balance', { ascending: false });

    return ((data ?? []) as Record<string, unknown>[]).map((d) => ({
      driverId: d.id as string,
      balance: (d.briga_coin_balance as number) ?? 0,
      totalEarned: 0,
      totalSpent: 0,
      lastUpdated: new Date(d.updated_at as string),
    }));
  }

  return Array.from(memBalanceStore.values());
}
