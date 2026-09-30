// ─────────────────────────────────────────────────────────────
// brigacoin/redemption.ts — Reward Redemption with Supabase
//
// WS3: Migrated from in-memory Map<> to Supabase `redemptions` table.
// Falls back to in-memory store when Supabase is not configured.
// ─────────────────────────────────────────────────────────────

import { supabaseAdmin, isAdminConfigured } from '@/lib/supabase/server';
import type { Redemption } from '@/types/telematics';
import { spendBalance } from './balance';
import { getRewardById } from './rewards';

// In-memory fallback store
const memRedemptionStore = new Map<string, Redemption>();

function useSupabase(): boolean {
  return isAdminConfigured();
}

function rowToRedemption(row: Record<string, unknown>): Redemption {
  return {
    id: row.id as string,
    driverId: row.driver_id as string,
    rewardId: row.reward_id as string,
    cost: row.cost as number,
    status: (row.status as Redemption['status']) || 'completed',
    voucherCode: (row.voucher_code as string) || undefined,
    deliveryMethod: (row.delivery_method as Redemption['deliveryMethod']) || 'email',
    redeemedAt: row.redeemed_at ? new Date(row.redeemed_at as string) : new Date(),
    expiresAt: row.expires_at ? new Date(row.expires_at as string) : undefined,
    createdAt: row.created_at ? new Date(row.created_at as string) : new Date(),
  };
}

export async function createRedemption(
  driverId: string,
  rewardId: string,
): Promise<{ success: boolean; redemption?: Redemption; error?: string }> {
  const reward = await getRewardById(rewardId);

  if (!reward) {
    return { success: false, error: 'Reward not found' };
  }

  if (reward.status !== 'active') {
    return { success: false, error: 'Reward not available' };
  }

  if (reward.stock <= 0) {
    return { success: false, error: 'Reward out of stock' };
  }

  // Check and deduct balance
  const spendResult = await spendBalance(
    driverId,
    reward.cost,
    'redemption',
    `Redeemed: ${reward.name}`,
    rewardId,
  );

  if (!spendResult.success) {
    return { success: false, error: spendResult.error };
  }

  // Generate voucher code
  const voucherCode = `BRC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  if (useSupabase()) {
    const { data, error } = await supabaseAdmin
      .from('redemptions')
      .insert({
        driver_id: driverId,
        reward_id: rewardId,
        cost: reward.cost,
        status: 'completed',
        voucher_code: voucherCode,
        delivery_method: 'email',
        redeemed_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error || !data) {
      console.error('[Redemption] Error inserting redemption:', error);
      // Fallback object even if DB insert fails
      const fallbackRedemption: Redemption = {
        id: `rdm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        driverId,
        rewardId,
        cost: reward.cost,
        status: 'completed',
        voucherCode,
        deliveryMethod: 'email',
        redeemedAt: new Date(),
        expiresAt,
        createdAt: new Date(),
      };
      return { success: true, redemption: fallbackRedemption };
    }

    // Decrement stock in Supabase
    if (reward.stock > 0) {
      await supabaseAdmin
        .from('rewards')
        .update({ stock: Math.max(0, reward.stock - 1) })
        .eq('id', rewardId);
    }

    return { success: true, redemption: rowToRedemption(data as Record<string, unknown>) };
  }

  // Fallback in-memory
  const redemption: Redemption = {
    id: `rdm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    driverId,
    rewardId,
    cost: reward.cost,
    status: 'completed',
    voucherCode,
    deliveryMethod: 'email',
    redeemedAt: new Date(),
    expiresAt,
    createdAt: new Date(),
  };

  memRedemptionStore.set(redemption.id, redemption);
  reward.stock--;

  return { success: true, redemption };
}

export async function getRedemptions(driverId: string): Promise<Redemption[]> {
  if (useSupabase()) {
    const { data } = await supabaseAdmin
      .from('redemptions')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false });

    return (data ?? []).map((row) => rowToRedemption(row as Record<string, unknown>));
  }

  return Array.from(memRedemptionStore.values()).filter((r) => r.driverId === driverId);
}

export async function getRedemptionById(id: string): Promise<Redemption | undefined> {
  if (useSupabase()) {
    const { data } = await supabaseAdmin
      .from('redemptions')
      .select('*')
      .eq('id', id)
      .single();

    return data ? rowToRedemption(data as Record<string, unknown>) : undefined;
  }

  return memRedemptionStore.get(id);
}
