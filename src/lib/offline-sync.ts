// ─────────────────────────────────────────────────────────────
// offline-sync.ts — Offline Data Queue & Background Sync
//
// Menyimpan submission trip ke IndexedDB saat offline,
// dan auto-sync saat koneksi kembali.
// ─────────────────────────────────────────────────────────────

import { db } from './db';

// ── Types ───────────────────────────────────────────────────
export interface QueuedSubmission {
  id?: number;
  tripId: string;
  payload: unknown;
  createdAt: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
}

// ── DB Schema Extension ─────────────────────────────────────
// We'll use a separate object store for offline submissions
// This is handled by adding to the existing Dexie db

// ── Queue Management ────────────────────────────────────────

/**
 * Add a submission to the offline queue
 */
export async function queueSubmission(tripId: string, payload: unknown): Promise<number> {
  const submission: QueuedSubmission = {
    tripId,
    payload,
    createdAt: Date.now(),
    retryCount: 0,
    status: 'pending',
  };

  // Store in a simple array in localStorage as fallback
  // In production, this would be a separate IndexedDB table
  const queue = getQueue();
  queue.push(submission);
  localStorage.setItem('briga_offline_queue', JSON.stringify(queue));

  return queue.length - 1;
}

/**
 * Get all pending submissions
 */
export function getQueue(): QueuedSubmission[] {
  try {
    const data = localStorage.getItem('briga_offline_queue');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Clear the queue
 */
export function clearQueue(): void {
  localStorage.removeItem('briga_offline_queue');
}

/**
 * Remove a specific submission from queue
 */
export function removeFromQueue(index: number): void {
  const queue = getQueue();
  queue.splice(index, 1);
  localStorage.setItem('briga_offline_queue', JSON.stringify(queue));
}

/**
 * Update submission status
 */
export function updateSubmissionStatus(index: number, status: QueuedSubmission['status']): void {
  const queue = getQueue();
  if (queue[index]) {
    queue[index].status = status;
    localStorage.setItem('briga_offline_queue', JSON.stringify(queue));
  }
}

/**
 * Process all pending submissions
 * Called when connection is restored
 */
export async function processQueue(): Promise<void> {
  const queue = getQueue();
  if (queue.length === 0) return;

  console.log(`[OfflineSync] Processing ${queue.length} pending submissions...`);

  for (let i = 0; i < queue.length; i++) {
    const submission = queue[i];
    if (submission.status === 'syncing') continue;

    updateSubmissionStatus(i, 'syncing');

    try {
      const response = await fetch('/api/trips/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission.payload),
      });

      if (response.ok) {
        removeFromQueue(i);
        i--; // Adjust index after removal
        console.log(`[OfflineSync] Synced submission for trip ${submission.tripId}`);
      } else {
        updateSubmissionStatus(i, 'failed');
      }
    } catch {
      updateSubmissionStatus(i, 'failed');
    }
  }
}

/**
 * Check if browser is online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Setup online/offline event listeners
 */
export function setupOnlineSync(callback?: () => void): () => void {
  const handleOnline = () => {
    console.log('[OfflineSync] Connection restored, processing queue...');
    processQueue();
    callback?.();
  };

  const handleOffline = () => {
    console.log('[OfflineSync] Connection lost');
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * Get queue status for UI display
 */
export function getQueueStatus(): {
  pending: number;
  failed: number;
  total: number;
} {
  const queue = getQueue();
  return {
    pending: queue.filter((s) => s.status === 'pending').length,
    failed: queue.filter((s) => s.status === 'failed').length,
    total: queue.length,
  };
}
