import { NextRequest, NextResponse } from 'next/server';
import { createRedemption, getRedemptions } from '@/lib/brigacoin/redemption';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get('driverId');

    if (!driverId) {
      return NextResponse.json(
        { success: false, error: 'driverId is required' },
        { status: 400 }
      );
    }

    const redemptions = getRedemptions(driverId);

    return NextResponse.json({
      success: true,
      data: redemptions,
    });
  } catch (error) {
    console.error('[API] Redemptions error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { driverId, rewardId } = await request.json();

    if (!driverId || !rewardId) {
      return NextResponse.json(
        { success: false, error: 'driverId and rewardId are required' },
        { status: 400 }
      );
    }

    const result = createRedemption(driverId, rewardId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Reward redeemed successfully',
      data: result.redemption,
    });
  } catch (error) {
    console.error('[API] Redeem error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
