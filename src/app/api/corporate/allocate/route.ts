import { NextRequest, NextResponse } from 'next/server';
import { allocateCorporateAllowance, MIN_COMMUTE_ALLOWANCE_BRC } from '@/lib/corporate/commute';
import { validateServiceAuth } from '@/lib/brigacoin/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = validateServiceAuth(request);
    // Allow internal service key or corporate auth
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { corporateId, employees, generateVouchers, expiryDays } = body;

    if (!corporateId) {
      return NextResponse.json(
        { success: false, error: 'corporateId is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(employees) || employees.length === 0) {
      return NextResponse.json(
        { success: false, error: 'employees must be a non-empty array' },
        { status: 400 }
      );
    }

    const result = await allocateCorporateAllowance(corporateId, employees, {
      generateVouchers: Boolean(generateVouchers),
      expiryDays: typeof expiryDays === 'number' ? expiryDays : 30,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        corporateId: result.corporateId,
        allocatedCount: result.allocatedCount,
        totalBrcAllocated: result.totalBrcAllocated,
        allowances: result.allowances,
        vouchersGenerated: result.vouchersGenerated,
      },
    });
  } catch (error) {
    console.error('[API] Corporate Allocate error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
