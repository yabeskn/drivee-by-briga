// ─────────────────────────────────────────────────────────────
// api/commuter/board/route.ts — Driver Boarding Validation API
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { validateAndBoardPass } from '@/lib/corporate/boarding';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, tripId, driverId } = body;

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Kode boarding pass wajib diisi' },
        { status: 400 }
      );
    }

    const result = await validateAndBoardPass(
      code,
      tripId || `trip_${Date.now()}`,
      driverId || 'driver_current'
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[API Commuter Board POST]', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan saat memvalidasi boarding pass' },
      { status: 500 }
    );
  }
}
