import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getBalance } from '@/lib/brigacoin/balance';
import { supabaseAdmin, isAdminConfigured } from '@/lib/supabase/server';

export async function GET() {
  try {
    const user = await requireAuth();
    const balance = await getBalance(user.id);

    let currentStreak = 0;
    let totalTrips = 0;
    let averageScore = 0;

    if (isAdminConfigured()) {
      const { data: driver } = await supabaseAdmin
        .from('drivers')
        .select('current_streak, total_trips, average_eco_score')
        .eq('id', user.id)
        .single();

      if (driver) {
        currentStreak = driver.current_streak || 0;
        totalTrips = driver.total_trips || 0;
        averageScore = Number(driver.average_eco_score || 0);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalRewards: balance.balance,
        currentStreak,
        totalTrips,
        averageScore,
        balance,
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
