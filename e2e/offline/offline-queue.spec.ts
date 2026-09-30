import { test, expect } from '@playwright/test';

test.describe('Offline Queue', () => {
  test('should show offline indicator when offline', async ({ page, context }) => {
    await page.goto('/go');
    await context.setOffline(true);
    await expect(page.locator('text=Koneksi terputus')).toBeVisible({ timeout: 5000 });
  });
});
