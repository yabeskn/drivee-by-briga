import { Redemption, Reward } from '@/types/telematics';
import { spendBalance } from './balance';
import { getRewardById } from './rewards';

// In-memory store (use database in production)
const redemptionStore = new Map<string, Redemption>();

export function createRedemption(
  driverId: string,
  rewardId: string
): { success: boolean; redemption?: Redemption; error?: string } {
  const reward = getRewardById(rewardId);

  if (!reward) {
    return { success: false, error: 'Reward not found' };
  }

  if (reward.status !== 'active') {
    return { success: false, error: 'Reward not available' };
  }

  if (reward.stock <= 0) {
    return { success: false, error: 'Reward out of stock' };
  }

  // Check balance
  const spendResult = spendBalance(
    driverId,
    reward.cost,
    'redemption',
    `Redeemed: ${reward.name}`,
    rewardId
  );

  if (!spendResult.success) {
    return { success: false, error: spendResult.error };
  }

  // Generate voucher code
  const voucherCode = `BRC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const redemption: Redemption = {
    id: `rdm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    driverId,
    rewardId,
    cost: reward.cost,
    status: 'completed',
    voucherCode,
    deliveryMethod: 'email',
    redeemedAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    createdAt: new Date(),
  };

  redemptionStore.set(redemption.id, redemption);

  // Update stock
  reward.stock--;

  return { success: true, redemption };
}

export function getRedemptions(driverId: string): Redemption[] {
  return Array.from(redemptionStore.values()).filter((r) => r.driverId === driverId);
}

export function getRedemptionById(id: string): Redemption | undefined {
  return redemptionStore.get(id);
}
