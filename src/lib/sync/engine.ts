import { supabase } from '@/lib/supabase/client';
import { db } from '@/lib/db';
import { notifyOfflineSyncComplete } from '@/lib/notifications';

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

export async function syncIndexedDBToSupabase(): Promise<SyncResult> {
  const result: SyncResult = { success: true, synced: 0, failed: 0, errors: [] };
  try {
    await syncOfflineQueue(result);
    if (result.synced > 0 && typeof window !== 'undefined') {
      notifyOfflineSyncComplete(result.synced).catch(() => {});
    }
  } catch (err) {
    result.success = false;
    result.errors.push(String(err));
  }
  return result;
}

async function syncOfflineQueue(result: SyncResult): Promise<void> {
  const pending = await db.offlineQueue.where('status').anyOf('pending', 'failed').toArray();
  if (pending.length === 0) return;
  for (const entry of pending) {
    if (!entry.id) continue;
    if (entry.retryCount >= 5) continue;
    try {
      const payload = JSON.parse(entry.payload);
      const response = await fetch('/api/trips/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        await db.offlineQueue.delete(entry.id);
        result.synced++;
      } else {
        await db.offlineQueue.update(entry.id, { status: 'failed', retryCount: entry.retryCount + 1 });
        result.failed++;
      }
    } catch (err) {
      await db.offlineQueue.update(entry.id, { status: 'failed', retryCount: entry.retryCount + 1 });
      result.failed++;
    }
  }
}

export function setupAutoSync(): () => void {
  const handleOnline = async () => { await syncIndexedDBToSupabase(); };
  window.addEventListener('online', handleOnline);
  if (navigator.onLine) { syncIndexedDBToSupabase(); }
  return () => { window.removeEventListener('online', handleOnline); };
}
