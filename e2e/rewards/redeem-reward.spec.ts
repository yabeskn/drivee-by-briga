import { test, expect } from '@playwright/test';

test.describe('Redeem Reward', () => {
  test('should show rewards catalog', async ({ page }) => {
    await page.goto('/rewards', { timeout: 10000 });
    await expect(page.locator('text=Available Rewards')).toBeVisible({ timeout: 5000 });
  });

  test('should show redeem button for each reward', async ({ page }) => {
    await page.goto('/rewards', { timeout: 10000 });
    await expect(page.locator('text=Redeem')).toBeVisible({ timeout: 5000 });
  });
});
