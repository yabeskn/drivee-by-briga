// ─────────────────────────────────────────────────────────────
// sw-register.ts — Service Worker Registration
// ─────────────────────────────────────────────────────────────

export interface SWRegistrationState {
  registered: boolean;
  updateAvailable: boolean;
  offlineReady: boolean;
}

let registration: ServiceWorkerRegistration | null = null;

/**
 * Register the service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[SW] Service Worker not supported');
    return null;
  }

  try {
    registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration?.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New version available
          console.log('[SW] New version available');
          notifyUpdateAvailable();
        }
      });
    });

    // Handle controller change (new SW took control)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[SW] New service worker activated');
    });

    console.log('[SW] Registered successfully');
    return registration;
  } catch (error) {
    console.error('[SW] Registration failed:', error);
    return null;
  }
}

/**
 * Check if a new version is available
 */
export function notifyUpdateAvailable(): void {
  window.dispatchEvent(new CustomEvent('sw-update-available'));
}

/**
 * Skip waiting and activate new service worker
 */
export async function skipWaiting(): Promise<void> {
  if (!registration?.waiting) return;
  registration.waiting.postMessage('skipWaiting');
}

/**
 * Request background sync permission
 */
export async function requestBackgroundSync(): Promise<void> {
  if (!registration) return;

  // SyncManager is not in standard TS lib yet
  const syncManager = (registration as unknown as { sync?: { register: (tag: string) => Promise<void> } }).sync;
  if (!syncManager) {
    console.warn('[SW] Background Sync not supported');
    return;
  }

  try {
    await syncManager.register('sync-trip-data');
    console.log('[SW] Background sync registered');
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

/**
 * Get current registration
 */
export function getRegistration(): ServiceWorkerRegistration | null {
  return registration;
}

/**
 * Check if service worker is supported
 */
export function isSWSupported(): boolean {
  return 'serviceWorker' in navigator;
}
