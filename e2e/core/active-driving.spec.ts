import { test, expect } from '@playwright/test';

test.describe('Active Driving HUD', () => {
  test('should show HUD elements or empty state', async ({ page }) => {
    await page.goto('/go');
    await expect(page.locator('text=Tidak Ada Data Perjalanan')).toBeVisible({ timeout: 5000 });
  });
});
