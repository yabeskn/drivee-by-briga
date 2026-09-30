import { test, expect } from '@playwright/test';

test.describe('Active Driving HUD', () => {
  test('should show HUD elements or empty state', async ({ page }) => {
    await page.goto('/go', { timeout: 10000 });
    await expect(page.locator('text=No Trip Data')).toBeVisible({ timeout: 5000 });
  });
});
