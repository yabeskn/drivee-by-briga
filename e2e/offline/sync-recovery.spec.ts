import { test, expect } from '@playwright/test';

test.describe('Sync Recovery', () => {
  test('should show connection restored when back online', async ({ page, context }) => {
    await page.goto('/go');
    await context.setOffline(true);
    await context.setOffline(false);
    await expect(page.locator('text=Koneksi dipulihkan')).toBeVisible({ timeout: 5000 });
  });
});
