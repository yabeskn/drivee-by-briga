import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const user = await requireAuth();

    const driver = await db.tripSessions
      .where('driverId')
      .equals(user.id)
      .first();

    // Calculate total rewards from all completed trips
    const trips = await db.tripSessions
      .where('driverId')
      .equals(user.id)
      .filter(t => t.status === 'completed')
      .toArray();

    const totalRewards = trips.reduce((sum, t) => sum + (t.totalPoints || 0), 0);
    // TripSession tidak menyimpan streak — streak dihitung dari profil driver (server), bukan sesi lokal
    const currentStreak = 0;

    return NextResponse.json({
      success: true,
      data: {
        totalRewards,
        currentStreak,
        totalTrips: trips.length,
        averageScore: trips.length > 0
          ? Math.round(trips.reduce((sum, t) => sum + (t.totalPoints || 0), 0) / trips.length)
          : 0,
      },
    });
  } catch (error) {
    console.error('[API] Rewards balance error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
