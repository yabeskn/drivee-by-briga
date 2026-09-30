import { NextRequest, NextResponse } from 'next/server';
import { submitAndVerifyTrip } from '@/lib/trip-submitter';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const result = await submitAndVerifyTrip({
      tripId: body.trip_id,
      driverId: user.id,
      vehicleId: body.vehicle_id,
      startTime: body.start_time,
      endTime: body.end_time,
      startBatterySoc: body.start_battery_soc,
      endBatterySoc: body.end_battery_soc,
      startOdometerKm: body.start_odometer_km,
      endOdometerKm: body.end_odometer_km,
      batteryCapacityKwh: body.battery_capacity_kwh,
      driverCurrentStreak: body.driver_current_streak,
      telemetryState: body.telemetry_state,
      startPhotoEvidence: body.start_photo_evidence,
      endPhotoEvidence: body.end_photo_evidence,
    });

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (error) {
    console.error('[API] Trip submit error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
