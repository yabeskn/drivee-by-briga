import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const user = await requireAuth();

    // Get vehicles associated with this driver
    const vehicles = await db.tripSessions
      .where('driverId')
      .equals(user.id)
      .toArray()
      .then(sessions => {
        const vehicleIds = [...new Set(sessions.map(s => s.vehicleId))];
        return vehicleIds;
      });

    return NextResponse.json({
      success: true,
      data: vehicles,
    });
  } catch (error) {
    console.error('[API] Vehicles error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const vehicle = {
      id: `veh_${Date.now()}`,
      driverId: user.id,
      ...body,
      createdAt: new Date(),
    };

    await db.tripSessions.add(vehicle);

    return NextResponse.json({
      success: true,
      data: vehicle,
    }, { status: 201 });
  } catch (error) {
    console.error('[API] Create vehicle error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
