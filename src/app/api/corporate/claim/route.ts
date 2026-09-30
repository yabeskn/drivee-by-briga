import { NextRequest, NextResponse } from 'next/server';
import { claimCorporateAllowance } from '@/lib/corporate/commute';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { userId, email, voucherCode } = body;

    if (!userId || !email) {
      return NextResponse.json(
        { success: false, error: 'userId and email are required' },
        { status: 400 }
      );
    }

    const result = await claimCorporateAllowance(userId, email, voucherCode);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        claimedAmount: result.claimedAmount,
        companyName: result.companyName,
        voucherCode: result.voucherCode,
        newBalance: result.newBalance,
        message: `Berhasil mengklaim ${result.claimedAmount} BrigaCoin dari ${result.companyName}`,
      },
    });
  } catch (error) {
    console.error('[API] Corporate Claim error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
