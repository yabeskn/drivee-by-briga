import { NextRequest, NextResponse } from 'next/server';
import { getBalance, getTransactions } from '@/lib/brigacoin/balance';

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

    const balance = getBalance(driverId);
    const transactions = getTransactions(driverId);

    return NextResponse.json({
      success: true,
      data: {
        balance,
        transactions,
      },
    });
  } catch (error) {
    console.error('[API] Balance error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
