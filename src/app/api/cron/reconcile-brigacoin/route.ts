import { NextRequest, NextResponse } from 'next/server';
import { runSystemReconciliation } from '@/lib/brigacoin/reconciliation';
import { validateServiceAuth } from '@/lib/brigacoin/auth';

export const dynamic = 'force-dynamic';

function isCronAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const customHeader = request.headers.get('x-cron-secret');

  // 1. Direct CRON_SECRET match
  if (cronSecret && (token === cronSecret || customHeader === cronSecret)) {
    return true;
  }

  // 2. Admin / Drifee service token fallback
  const serviceAuth = validateServiceAuth(request);
  if (serviceAuth.authenticated && (serviceAuth.actor === 'admin' || serviceAuth.actor === 'drifee')) {
    return true;
  }

  // 3. Fallback when CRON_SECRET is not explicitly set in dev / test mode
  if (!cronSecret && process.env.NODE_ENV !== 'production') {
    return true;
  }

  return false;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: valid CRON_SECRET or service key required' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const autoFix =
    searchParams.get('autoFix') === 'true' || searchParams.get('auto_fix') === 'true';

  try {
    const report = await runSystemReconciliation(autoFix);

    if (report.driftCount > 0) {
      console.warn(
        `[CRON Reconcile BrigaCoin] ALERT: Detected ${report.driftCount} account drifts totaling ${report.totalDriftAmount} BRC!`
      );
    }

    return NextResponse.json({
      success: true,
      job: 'reconcile-brigacoin',
      executed_at: new Date().toISOString(),
      report,
    });
  } catch (error) {
    console.error('[CRON Reconcile BrigaCoin] Execution failure:', error);
    return NextResponse.json(
      { success: false, error: 'Reconciliation job failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: valid CRON_SECRET or service key required' },
      { status: 401 }
    );
  }

  try {
    let autoFix = false;
    try {
      const body = await request.json();
      autoFix = Boolean(body.auto_fix || body.autoFix);
    } catch {
      // Body is optional
    }

    const report = await runSystemReconciliation(autoFix);

    return NextResponse.json({
      success: true,
      job: 'reconcile-brigacoin',
      executed_at: new Date().toISOString(),
      report,
    });
  } catch (error) {
    console.error('[CRON Reconcile BrigaCoin] POST execution failure:', error);
    return NextResponse.json(
      { success: false, error: 'Reconciliation job failed' },
      { status: 500 }
    );
  }
}
