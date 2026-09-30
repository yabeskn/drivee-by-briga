// ─────────────────────────────────────────────────────────────
// lib/notifications.ts — Web Notifications & Rewards Alerting
//
// Manages browser notification permissions and delivers
// feedback for trip verification, offline sync, and reward milestones.
// ─────────────────────────────────────────────────────────────

/**
 * Check if notifications are supported in the current browser.
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Request notification permission from the driver.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch {
    return 'denied';
  }
}

/**
 * Display a notification using Service Worker registration if available,
 * falling back to the standard HTML5 Notification API.
 */
export async function showNotification(
  title: string,
  options?: NotificationOptions & { url?: string }
): Promise<boolean> {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  const notificationOptions: NotificationOptions = {
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    ...options,
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          ...notificationOptions,
          data: { url: options?.url || '/' },
        });
        return true;
      }
    }

    new Notification(title, notificationOptions);
    return true;
  } catch (err) {
    console.warn('[Notification] Failed to display notification:', err);
    return false;
  }
}

/**
 * Notify driver when BrigaCoins are awarded.
 */
export async function notifyRewardEarned(tokens: number, ecoScore: number, streakBonus = 0): Promise<void> {
  const streakText = streakBonus > 0 ? ` (Termasuk +${streakBonus} streak bonus!)` : '';
  await showNotification('🎉 Hadiah BrigaCoins Masuk!', {
    body: `Trip terverifikasi! Anda mendapatkan +${tokens} BrigaCoins dengan Eco-Score ${ecoScore}.${streakText}`,
    url: '/rewards',
  });
}

/**
 * Notify driver when offline queue has successfully flushed.
 */
export async function notifyOfflineSyncComplete(syncedCount: number): Promise<void> {
  if (syncedCount <= 0) return;
  await showNotification('⚡ Sinkronisasi Offline Berhasil', {
    body: `${syncedCount} trip offline telah diverifikasi dan disinkronkan ke cloud.`,
    url: '/go',
  });
}
