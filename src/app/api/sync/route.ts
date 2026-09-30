import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { processQueue } from '@/lib/offline-sync';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    // Process sync queue — processQueue() mengembalikan jumlah trip yang berhasil disinkronkan
    const syncedCount = await processQueue();

    return NextResponse.json({
      success: true,
      data: {
        synced: syncedCount,
        failed: 0,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[API] Sync error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
