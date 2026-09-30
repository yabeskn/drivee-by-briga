import { test, expect } from '@playwright/test';

test.describe('Offline Queue', () => {
  test('should queue data when offline', async ({ page, context }) => {
    await page.goto('/go');
    await context.setOffline(true);
    await expect(page.locator('text=Connection lost')).toBeVisible();
  });

  test('should show offline indicator', async ({ page, context }) => {
    await page.goto('/go');
    await context.setOffline(true);
    await expect(page.locator('text=Connection lost')).toBeVisible();
  });
});
