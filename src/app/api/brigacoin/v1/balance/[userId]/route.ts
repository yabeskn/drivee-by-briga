import { NextRequest, NextResponse } from 'next/server';
import { getBalance } from '@/lib/brigacoin/balance';
import { validateServiceAuth } from '@/lib/brigacoin/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
): Promise<NextResponse> {
  const auth = validateServiceAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  const { userId } = params;
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'User ID is required' },
      { status: 400 }
    );
  }

  try {
    const balance = await getBalance(userId);
    return NextResponse.json({
      success: true,
      data: {
        user_id: userId,
        balance: balance.balance,
        total_earned: balance.totalEarned,
        total_spent: balance.totalSpent,
        updated_at: balance.lastUpdated.toISOString(),
      },
    });
  } catch (error) {
    console.error('[API Unified BrigaCoin] Balance query error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
