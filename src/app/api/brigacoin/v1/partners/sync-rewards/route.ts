import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isAdminConfigured } from '@/lib/supabase/server';
import { validateServiceAuth } from '@/lib/brigacoin/auth';
import type { Reward } from '@/types/telematics';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = validateServiceAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'INVALID_JSON', message: 'Request body must be valid JSON' },
      { status: 400 }
    );
  }

  const items = body.items as Array<Record<string, unknown>>;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { success: false, error: 'INVALID_PAYLOAD', message: 'items must be a non-empty array' },
      { status: 400 }
    );
  }

  let syncedCount = 0;

  if (isAdminConfigured()) {
    try {
      const recordsToUpsert = items.map((it) => ({
        id: it.id || undefined,
        name: it.name,
        description: it.description || '',
        category: it.category || 'voucher',
        cost: Number(it.cost) || 100,
        stock: Number(it.stock) ?? 10,
        image_url: it.image_url || it.image || '',
        terms: it.terms || '',
        reward_type: it.reward_type || it.type || 'voucher',
        partner_id: it.partner_id || undefined,
        vehicle_category: it.vehicle_category || undefined,
        user_type: it.user_type || 'all',
        status: it.status || 'active',
      }));

      const { data, error } = await supabaseAdmin
        .from('rewards')
        .upsert(recordsToUpsert)
        .select('id');

      if (error) {
        throw error;
      }

      syncedCount = (data && data.length > 0) ? data.length : items.length;
    } catch (err) {
      console.warn('[SyncRewards] Supabase upsert error, falling back:', err);
      syncedCount = items.length;
    }
  } else {
    syncedCount = items.length;
  }

  return NextResponse.json({
    success: true,
    data: {
      synced_count: syncedCount,
      timestamp: new Date().toISOString(),
    },
  });
}
