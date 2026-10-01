// ─────────────────────────────────────────────────────────────
// api/commuter/boarding/route.ts — Commuter Boarding Pass API
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import {
  createBoardingPass,
  getActiveBoardingPass,
  getPassengerCommuterSummary,
} from '@/lib/corporate/boarding';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const email = searchParams.get('email') || '';

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Parameter userId wajib disertakan' },
        { status: 400 }
      );
    }

    const activePass = await getActiveBoardingPass(userId);
    const summary = await getPassengerCommuterSummary(userId, email);

    return NextResponse.json({
      success: true,
      activePass,
      summary,
    });
  } catch (error) {
    console.error('[API Commuter Boarding GET]', error);
    return NextResponse.json(
      { success: false, error: 'Gagal mengambil data boarding pass' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      passengerEmail,
      passengerName,
      discountBrcSelected,
      estimatedFareIdr,
      routeCorridor,
      corporateId,
      companyName,
    } = body;

    if (!userId || !passengerEmail) {
      return NextResponse.json(
        { success: false, error: 'userId dan passengerEmail wajib diisi' },
        { status: 400 }
      );
    }

    const pass = await createBoardingPass({
      userId,
      passengerEmail,
      passengerName: passengerName || passengerEmail.split('@')[0],
      discountBrcSelected: Number(discountBrcSelected) || 0,
      estimatedFareIdr: Number(estimatedFareIdr) || 45000,
      routeCorridor: routeCorridor || 'Lippo Cikarang → GIIC Deltamas',
      corporateId,
      companyName,
    });

    return NextResponse.json({
      success: true,
      data: pass,
    });
  } catch (error) {
    console.error('[API Commuter Boarding POST]', error);
    return NextResponse.json(
      { success: false, error: 'Gagal membuat boarding pass' },
      { status: 500 }
    );
  }
}
