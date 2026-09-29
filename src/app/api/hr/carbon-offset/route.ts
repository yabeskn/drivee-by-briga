import { NextRequest, NextResponse } from 'next/server';
import { buyCarbonOffset, getCarbonOffsets } from '@/lib/hr/rental';

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

    const offsets = getCarbonOffsets(companyId);

    return NextResponse.json({
      success: true,
      data: offsets,
    });
  } catch (error) {
    console.error('[API] Carbon offset error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { companyId, amountKg, type } = await request.json();

    if (!companyId || !amountKg || !type) {
      return NextResponse.json(
        { success: false, error: 'companyId, amountKg, and type are required' },
        { status: 400 }
      );
    }

    const result = buyCarbonOffset(companyId, amountKg, type);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Carbon offset purchased',
      data: result.offset,
    });
  } catch (error) {
    console.error('[API] Carbon offset purchase error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
