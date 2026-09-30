import { NextRequest, NextResponse } from 'next/server';
import { getCorporateEmissionSummary } from '@/lib/corporate/commute';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const corporateId = searchParams.get('corporateId') || 'demo-corp-cikarang';

    const summary = await getCorporateEmissionSummary(corporateId);

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('[API] Corporate Emissions error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
