import { test, expect } from '@playwright/test';

test.describe('Redeem Reward', () => {
  test('should show rewards catalog', async ({ page }) => {
    await page.goto('/rewards');
    await expect(page.locator('text=Reward Tersedia')).toBeVisible({ timeout: 5000 });
  });

  test('should show redeem button for each reward', async ({ page }) => {
    await page.goto('/rewards');
    await expect(page.locator('text=Tukar')).toBeVisible({ timeout: 5000 });
  });
});
