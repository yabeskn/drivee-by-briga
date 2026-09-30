import { NextRequest, NextResponse } from 'next/server';
import { getRewards } from '@/lib/brigacoin/rewards';
import { VehicleCategory, UserType } from '@/types/telematics';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const userType = searchParams.get('userType') as UserType | null;
    const vehicleCategory = searchParams.get('vehicleCategory') as VehicleCategory | null;

    const rewards = await getRewards(userType || undefined, vehicleCategory || undefined);

    return NextResponse.json({
      success: true,
      data: rewards,
    });
  } catch (error) {
    console.error('[API] Rewards error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
