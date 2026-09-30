import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const trips = await db.tripSessions
      .where('driverId')
      .equals(user.id)
      .reverse()
      .sortBy('startedAt')
      .then(trips => trips.slice(offset, offset + limit));

    const total = await db.tripSessions
      .where('driverId')
      .equals(user.id)
      .count();

    return NextResponse.json({
      success: true,
      data: trips,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('[API] Trip history error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
