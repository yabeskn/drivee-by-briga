// ─────────────────────────────────────────────────────────────
// offline-sync.ts — Offline Data Queue & Background Sync
//
// Menyimpan submission trip ke IndexedDB saat offline,
// dan auto-sync saat koneksi kembali.
//
// FIX B1+B2: Migrasi dari localStorage (5MB limit) ke
// IndexedDB (offlineQueue table) agar trip multi-jam
// Jabodetabek tidak kehilangan data.
// ─────────────────────────────────────────────────────────────

import { db, type OfflineQueueEntry } from './db';
import { purgeVerifiedTrip, purgeOldTrips } from './db';

// ── Queue Management (IndexedDB-backed) ─────────────────────

/**
 * Add a submission to the offline queue (IndexedDB).
 * Called by trip-submitter when fetch fails due to offline.
 */
export async function queueSubmission(tripId: string, payload: unknown): Promise<number> {
  const entry: OfflineQueueEntry = {
    tripId,
    payload: JSON.stringify(payload), // Stringify to avoid Dexie clone issues
    createdAt: Date.now(),
    retryCount: 0,
    status: 'pending',
  };

  const id = await db.offlineQueue.add(entry);
  console.log(`[OfflineSync] Queued trip ${tripId} (entry #${id})`);
  return id as number;
}

/**
 * Get all pending submissions from IndexedDB
 */
export async function getQueue(): Promise<OfflineQueueEntry[]> {
  return db.offlineQueue.toArray();
}

/**
 * Get pending count for UI display
 */
export async function getPendingCount(): Promise<number> {
  return db.offlineQueue.where('status').equals('pending').count();
}

/**
 * Clear the entire queue
 */
export async function clearQueue(): Promise<void> {
  await db.offlineQueue.clear();
}

/**
 * Remove a specific entry by id
 */
export async function removeFromQueue(entryId: number): Promise<void> {
  await db.offlineQueue.delete(entryId);
}

/**
 * Update submission status
 */
export async function updateSubmissionStatus(
  entryId: number,
  status: OfflineQueueEntry['status'],
  incrementRetry = false,
): Promise<void> {
  const updates: Partial<OfflineQueueEntry> = { status };
  if (incrementRetry) {
    const entry = await db.offlineQueue.get(entryId);
    if (entry) {
      updates.retryCount = (entry.retryCount || 0) + 1;
    }
  }
  await db.offlineQueue.update(entryId, updates);
}

/**
 * Process all pending submissions when connection is restored.
 * Returns count of successfully synced trips.
 */
export async function processQueue(): Promise<number> {
  const pending = await db.offlineQueue
    .where('status')
    .anyOf('pending', 'failed')
    .toArray();

  if (pending.length === 0) return 0;

  console.log(`[OfflineSync] Processing ${pending.length} pending submissions...`);
  let syncedCount = 0;

  for (const entry of pending) {
    if (!entry.id) continue;

    // Skip entries that have been retried too many times
    if (entry.retryCount >= 5) {
      console.warn(`[OfflineSync] Skipping trip ${entry.tripId} — max retries exceeded`);
      continue;
    }

    await updateSubmissionStatus(entry.id, 'syncing');

    try {
      const payload = JSON.parse(entry.payload);

      const response = await fetch('/api/trips/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();

        // Auto-purge telemetry points if verified
        if (result.status === 'VERIFIED' || result.verification_status === 'VERIFIED') {
          try {
            await purgeVerifiedTrip(entry.tripId);
          } catch (purgeErr) {
            console.warn(`[OfflineSync] Purge failed for ${entry.tripId}:`, purgeErr);
          }
        }

        // Remove from queue on success
        await removeFromQueue(entry.id);
        syncedCount++;
        console.log(`[OfflineSync] ✅ Synced trip ${entry.tripId}`);
      } else {
        // Server responded but with error
        await updateSubmissionStatus(entry.id, 'failed', true);
        console.warn(`[OfflineSync] Server rejected trip ${entry.tripId}: ${response.status}`);
      }
    } catch (err) {
      // Network error — still offline, put back to pending
      await updateSubmissionStatus(entry.id, 'failed', true);
      console.warn(`[OfflineSync] Network error for trip ${entry.tripId}:`, err);
    }
  }

  // Safety net: purge old synced trips
  try {
    await purgeOldTrips(24 * 60 * 60 * 1000);
  } catch {
    // Non-critical
  }

  return syncedCount;
}

/**
 * Check if browser is online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Setup online/offline event listeners.
 * Automatically processes queue when connectivity returns.
 */
export function setupOnlineSync(callback?: (syncedCount: number) => void): () => void {
  const handleOnline = async () => {
    console.log('[OfflineSync] Connection restored, processing queue...');
    const synced = await processQueue();
    callback?.(synced);
  };

  const handleOffline = () => {
    console.log('[OfflineSync] Connection lost — data will be queued to IndexedDB');
  };

  // Also listen for SW background sync messages
  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type === 'SYNC_TRIP_DATA') {
      processQueue();
    }
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  navigator.serviceWorker?.addEventListener('message', handleMessage);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    navigator.serviceWorker?.removeEventListener('message', handleMessage);
  };
}

/**
 * Get queue status for UI display
 */
export async function getQueueStatus(): Promise<{
  pending: number;
  failed: number;
  total: number;
}> {
  const all = await db.offlineQueue.toArray();
  return {
    pending: all.filter((s) => s.status === 'pending').length,
    failed: all.filter((s) => s.status === 'failed').length,
    total: all.length,
  };
}

/**
 * Migrate any leftover localStorage queue data to IndexedDB.
 * Call once on app startup for backwards compatibility.
 */
export async function migrateLocalStorageQueue(): Promise<number> {
  try {
    const raw = localStorage.getItem('briga_offline_queue');
    if (!raw) return 0;

    const items = JSON.parse(raw) as Array<{
      tripId: string;
      payload: unknown;
      createdAt: number;
      retryCount: number;
      status: string;
    }>;

    if (items.length === 0) return 0;

    const entries: OfflineQueueEntry[] = items.map((item) => ({
      tripId: item.tripId,
      payload: typeof item.payload === 'string' ? item.payload : JSON.stringify(item.payload),
      createdAt: item.createdAt,
      retryCount: item.retryCount || 0,
      status: (item.status === 'pending' || item.status === 'failed') ? item.status : 'pending',
    }));

    await db.offlineQueue.bulkAdd(entries);
    localStorage.removeItem('briga_offline_queue');

    console.log(`[OfflineSync] Migrated ${entries.length} entries from localStorage to IndexedDB`);
    return entries.length;
  } catch {
    return 0;
  }
}
