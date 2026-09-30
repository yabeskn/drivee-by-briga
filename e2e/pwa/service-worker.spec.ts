import { test, expect } from '@playwright/test';

test.describe('Service Worker', () => {
  test('should register service worker', async ({ page }) => {
    await page.goto('/', { timeout: 10000 });
    const swRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        return !!registration;
      }
      return false;
    });
    expect(swRegistered).toBe(true);
  });
});
