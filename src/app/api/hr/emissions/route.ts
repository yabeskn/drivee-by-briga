import { NextRequest, NextResponse } from 'next/server';
import { getEmissions, trackEmission, calculateMonthlyEmission, rentalPackages } from '@/lib/hr/rental';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'companyId is required' },
        { status: 400 }
      );
    }

    const emissions = await getEmissions(companyId);

    // Calculate totals
    const totalEmission = emissions.reduce((sum, e) => sum + e.totalEmissionKg, 0);
    const totalOffset = emissions.reduce((sum, e) => sum + e.offsetKg, 0);
    const netEmission = totalEmission - totalOffset;
    const totalBrc = emissions.reduce((sum, e) => sum + e.brcEarned, 0);

    return NextResponse.json({
      success: true,
      data: {
        emissions,
        summary: {
          totalEmissionKg: totalEmission,
          totalOffsetKg: totalOffset,
          netEmissionKg: netEmission,
          totalBrcEarned: totalBrc,
        },
      },
    });
  } catch (error) {
    console.error('[API] HR emissions error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { companyId, rentalId, distanceKm, category } = await request.json();

    if (!companyId || !rentalId || !distanceKm || !category) {
      return NextResponse.json(
        { success: false, error: 'All fields are required' },
        { status: 400 }
      );
    }

    const emission = await trackEmission(companyId, rentalId, distanceKm, category);

    return NextResponse.json({
      success: true,
      message: 'Emission tracked',
      data: emission,
    });
  } catch (error) {
    console.error('[API] HR emission track error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
