import { test, expect } from '@playwright/test';

test.describe('Sync Recovery', () => {
  test('should auto-sync when back online', async ({ page, context }) => {
    await page.goto('/go');
    await context.setOffline(true);
    await context.setOffline(false);
    await expect(page.locator('text=Connection restored')).toBeVisible();
  });

  test('should process queued submissions', async ({ page, context }) => {
    await page.goto('/go');
    await context.setOffline(true);
    await context.setOffline(false);
    await page.waitForTimeout(2000);
    await expect(page.locator('text=Sync complete')).toBeVisible();
  });
});
