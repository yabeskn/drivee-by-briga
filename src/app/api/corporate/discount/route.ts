import { NextRequest, NextResponse } from 'next/server';
import { calculateCommuteFareDiscount, recordCorporateCommuteTrip } from '@/lib/corporate/commute';
import { getBalance } from '@/lib/brigacoin/balance';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { action, userId, userEmail, fareIdr, coinsToSpend, distanceKm, tripId, corporateId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    const currentBalanceObj = await getBalance(userId);
    const balance = currentBalanceObj.balance;

    // Action 1: Preview / Calculate discount before confirming booking
    if (action === 'calculate' || !action) {
      const calculation = calculateCommuteFareDiscount(
        Number(fareIdr || 0),
        Number(coinsToSpend || 0),
        balance,
        Number(distanceKm || 0)
      );

      if (!calculation.isValid) {
        return NextResponse.json(
          { success: false, error: calculation.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          ...calculation,
          userCurrentBalance: balance,
        },
      });
    }

    // Action 2: Apply discount and record trip completion
    if (action === 'apply') {
      if (!tripId) {
        return NextResponse.json(
          { success: false, error: 'tripId is required when action is apply' },
          { status: 400 }
        );
      }

      const tripRes = await recordCorporateCommuteTrip({
        userId,
        userEmail: userEmail || `${userId}@user.drifee.briga.id`,
        tripId,
        distanceKm: Number(distanceKm || 0),
        brcSpent: Number(coinsToSpend || 0),
        fareIdr: Number(fareIdr || 0),
        corporateId,
      });

      if (!tripRes.success) {
        return NextResponse.json(
          { success: false, error: tripRes.error },
          { status: 400 }
        );
      }

      const updatedBalanceObj = await getBalance(userId);

      return NextResponse.json({
        success: true,
        data: {
          co2SavedKg: tripRes.co2SavedKg,
          netFareIdr: tripRes.netFareIdr,
          newBalance: updatedBalanceObj.balance,
          message: 'Potongan BrigaCoin berhasil diterapkan untuk perjalanan Mobil EV Anda',
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action parameter' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API] Corporate Discount error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
