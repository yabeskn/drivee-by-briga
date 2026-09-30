import { NextRequest, NextResponse } from 'next/server';
import { getBrigaCoinMetrics } from '@/lib/brigacoin/metrics';
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

  try {
    const metrics = await getBrigaCoinMetrics();
    return NextResponse.json({ success: true, data: metrics });
  } catch (error) {
    console.error('[API Metrics] Failed to generate BrigaCoin metrics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve observability metrics' },
      { status: 500 }
    );
  }
}
