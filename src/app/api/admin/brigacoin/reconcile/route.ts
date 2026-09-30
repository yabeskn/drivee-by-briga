import { NextRequest, NextResponse } from 'next/server';
import { runSystemReconciliation, reconcileUserBalance } from '@/lib/brigacoin/reconciliation';
import { validateServiceAuth } from '@/lib/brigacoin/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = validateServiceAuth(request);
  if (!auth.authenticated || (auth.actor !== 'admin' && auth.actor !== 'drifee')) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: admin access required' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  try {
    if (userId) {
      const userReport = await reconcileUserBalance(userId, false);
      return NextResponse.json({ success: true, data: userReport });
    }

    const report = await runSystemReconciliation(false);
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error('[API Reconciliation] Audit error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run reconciliation audit' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = validateServiceAuth(request);
  if (!auth.authenticated || auth.actor !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: admin role required for mutations' },
      { status: 401 }
    );
  }

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is okay
    }

    const userId = body.user_id as string | undefined;
    const autoFix = Boolean(body.auto_fix);

    if (userId) {
      const result = await reconcileUserBalance(userId, autoFix);
      return NextResponse.json({ success: true, data: result });
    }

    const report = await runSystemReconciliation(autoFix);
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error('[API Reconciliation] Fix error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run reconciliation fix' },
      { status: 500 }
    );
  }
}
