import { test, expect } from '@playwright/test';

test.describe('Service Worker', () => {
  test('should register service worker', async ({ page }) => {
    await page.goto('/');
    const swRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        return !!registration;
      }
      return false;
    });
    expect(swRegistered).toBe(true);
  });

  test('should cache static assets', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    const cacheExists = await page.evaluate(async () => {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        return cacheNames.length > 0;
      }
      return false;
    });
    expect(cacheExists).toBe(true);
  });
});
