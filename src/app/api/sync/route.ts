import { NextRequest, NextResponse } from 'next/server';
import { syncIndexedDBToSupabase } from '@/lib/sync/engine';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const result = await syncIndexedDBToSupabase();
    return NextResponse.json({
      success: result.success,
      data: { synced: result.synced, failed: result.failed, errors: result.errors },
    });
  } catch (error) {
    console.error('[API] Sync error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
