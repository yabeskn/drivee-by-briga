import { NextRequest, NextResponse } from 'next/server';
import { getTransactions } from '@/lib/brigacoin/balance';
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
    const transactions = await getTransactions(userId);

    const items = transactions.map((t) => ({
      id: t.id,
      user_id: t.driverId,
      type: t.type,
      amount: t.amount,
      balance_after: t.balance,
      source: t.source,
      reference_id: t.referenceId || null,
      description: t.description,
      created_at: t.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        items,
        next_cursor: null,
      },
    });
  } catch (error) {
    console.error('[API Unified BrigaCoin] Transactions query error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
