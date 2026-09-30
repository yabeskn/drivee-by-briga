import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isAdminConfigured } from '@/lib/supabase/server';
import { spendBalance, getBalance } from '@/lib/brigacoin/balance';
import { getRewardById } from '@/lib/brigacoin/rewards';
import { validateServiceAuth } from '@/lib/brigacoin/auth';
import { dispatchWebhookEvent } from '@/lib/brigacoin/webhooks';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = validateServiceAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'INVALID_JSON', message: 'Request body must be valid JSON' },
      { status: 400 }
    );
  }

  const userId = (body.user_id as string)?.trim();
  const rewardId = (body.reward_id as string)?.trim();
  const idempotencyKey = (body.idempotency_key as string)?.trim();
  const deliveryMethod = (body.delivery_method as string)?.trim() || 'auto';

  if (!userId || !rewardId) {
    return NextResponse.json(
      { success: false, error: 'INVALID_PAYLOAD', message: 'user_id and reward_id are required' },
      { status: 400 }
    );
  }

  try {
    // 1. Fetch reward
    const reward = await getRewardById(rewardId);
    if (!reward) {
      return NextResponse.json(
        { success: false, error: 'REWARD_NOT_FOUND', message: 'Reward item does not exist' },
        { status: 404 }
      );
    }

    if (reward.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'REWARD_INACTIVE', message: 'Reward item is inactive' },
        { status: 400 }
      );
    }

    if (reward.stock <= 0) {
      return NextResponse.json(
        { success: false, error: 'OUT_OF_STOCK', message: 'Reward item is out of stock' },
        { status: 400 }
      );
    }

    // 2. Debit balance atomically via Unified BrigaCoin spend
    const spendResult = await spendBalance(
      userId,
      reward.cost,
      'redemption',
      `Redeemed partner reward: ${reward.name}`,
      rewardId,
      {
        idempotencyKey: idempotencyKey || `redeem:${rewardId}:${userId}`,
        actor: 'briga',
        userId,
      }
    );

    if (!spendResult.success) {
      if (spendResult.error === 'Insufficient balance') {
        const current = await getBalance(userId);
        return NextResponse.json(
          {
            success: false,
            error: 'INSUFFICIENT_BALANCE',
            message: 'Saldo koin tidak mencukupi untuk penukaran ini',
            balance: current.balance,
            cost: reward.cost,
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { success: false, error: spendResult.error || 'SPEND_FAILED' },
        { status: 400 }
      );
    }

    // 3. Generate voucher code
    const voucherCode = `BRC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const redemptionId = `rdm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    if (isAdminConfigured()) {
      try {
        await supabaseAdmin
          .from('redemptions')
          .insert({
            driver_id: userId,
            reward_id: rewardId,
            cost: reward.cost,
            status: 'completed',
            voucher_code: voucherCode,
            delivery_method: deliveryMethod,
            redeemed_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
          });

        // Decrement stock
        await supabaseAdmin
          .from('rewards')
          .update({ stock: Math.max(0, reward.stock - 1) })
          .eq('id', rewardId);
      } catch (err) {
        console.warn('[Redeem] Non-critical db error updating redemption/stock:', err);
      }
    }

    // 4. Trigger webhook event
    dispatchWebhookEvent('redemption.completed', {
      user_id: userId,
      reward_id: rewardId,
      reward_name: reward.name,
      voucher_code: voucherCode,
      cost: reward.cost,
      balance_after: spendResult.balance?.balance,
      expires_at: expiresAt.toISOString(),
    }, 'briga').catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        redemption_id: redemptionId,
        voucher_code: voucherCode,
        reward_name: reward.name,
        cost: reward.cost,
        balance: spendResult.balance?.balance,
        expires_at: expiresAt.toISOString(),
        duplicate: Boolean(spendResult.duplicate),
      },
    });
  } catch (error) {
    console.error('[API Unified BrigaCoin] Partner redeem error:', error);
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: 'Failed to process redemption' },
      { status: 500 }
    );
  }
}
