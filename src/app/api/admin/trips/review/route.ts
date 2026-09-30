// ─────────────────────────────────────────────────────────────
// /api/admin/trips/review — Manual Trip Verification Review API
//
// Allows fleet administrators to manually inspect, approve,
// or reject pending or disputed trips.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isAdminConfigured } from '@/lib/supabase/server';
import { addBalance } from '@/lib/brigacoin/balance';
import { captureException } from '@/lib/sentry';

interface ReviewTripPayload {
  trip_id: string;
  decision: 'VERIFIED' | 'REJECTED';
  notes?: string;
  admin_id?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: ReviewTripPayload = await request.json();

    if (!body.trip_id || !body.decision) {
      return NextResponse.json(
        { success: false, error: 'trip_id and decision are required' },
        { status: 400 }
      );
    }

    if (!['VERIFIED', 'REJECTED'].includes(body.decision)) {
      return NextResponse.json(
        { success: false, error: 'decision must be VERIFIED or REJECTED' },
        { status: 400 }
      );
    }

    if (!isAdminConfigured()) {
      return NextResponse.json({
        success: true,
        message: `Admin review simulation: Trip ${body.trip_id} marked as ${body.decision}`,
        trip_id: body.trip_id,
        verification_status: body.decision,
        tokens_awarded: body.decision === 'VERIFIED' ? 50 : 0,
      });
    }

    // 1. Fetch trip record
    const { data: trip, error: tripErr } = await supabaseAdmin
      .from('trips')
      .select('*, drivers(*)')
      .eq('id', body.trip_id)
      .single();

    if (tripErr || !trip) {
      return NextResponse.json(
        { success: false, error: `Trip not found: ${body.trip_id}` },
        { status: 404 }
      );
    }

    const newStatus = body.decision.toLowerCase() as 'verified' | 'rejected';
    let tokensAwarded = 0;

    // 2. Process approval economics if changing to verified
    if (newStatus === 'verified' && trip.verification_status !== 'verified') {
      const distanceKm = Number(trip.distance_km) || 0;
      const ecoScore = Number(trip.eco_score) || 0;

      const baseReward = Math.round(distanceKm * 10);
      const ecoMultiplierReward = Math.round((ecoScore / 100) * 0.5 * baseReward);

      const driver = trip.drivers as Record<string, unknown> | null;
      const currentStreak = Number(driver?.current_streak || 0);
      const newStreak = ecoScore >= 85 ? currentStreak + 1 : 0;
      const streakBonus = newStreak > 0 && newStreak % 5 === 0 ? 50 : 0;

      tokensAwarded = baseReward + ecoMultiplierReward + streakBonus;

      // Update driver statistics & balance
      if (trip.driver_id) {
        await addBalance(
          trip.driver_id,
          tokensAwarded,
          'adjustment',
          `Reward verified trip ${trip.id} (Manual Review)`,
          trip.id
        );

        const currentTotalTrips = Number(driver?.total_trips || 0);
        const currentAvgScore = Number(driver?.average_eco_score || 0);
        const newTotalTrips = currentTotalTrips + 1;
        const newAvgScore = Number(
          ((currentAvgScore * currentTotalTrips + ecoScore) / newTotalTrips).toFixed(1)
        );

        await supabaseAdmin
          .from('drivers')
          .update({
            current_streak: newStreak,
            total_trips: newTotalTrips,
            average_eco_score: newAvgScore,
            updated_at: new Date().toISOString(),
          })
          .eq('id', trip.driver_id);
      }
    }

    // 3. Update trip status
    const { error: updateErr } = await supabaseAdmin
      .from('trips')
      .update({
        verification_status: newStatus,
        tokens_earned: tokensAwarded > 0 ? tokensAwarded : trip.tokens_earned,
      })
      .eq('id', body.trip_id);

    if (updateErr) {
      throw updateErr;
    }

    return NextResponse.json({
      success: true,
      trip_id: body.trip_id,
      verification_status: body.decision,
      tokens_awarded: tokensAwarded,
      notes: body.notes,
      message: `Trip successfully updated to ${body.decision}`,
    });
  } catch (error) {
    await captureException(error, {
      tags: { endpoint: '/api/admin/trips/review' },
    });

    console.error('[API] Admin trip review error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process admin review' },
      { status: 500 }
    );
  }
}
