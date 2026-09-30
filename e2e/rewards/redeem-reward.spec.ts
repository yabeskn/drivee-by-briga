import { test, expect } from '@playwright/test';

test.describe('Redeem Reward', () => {
  test('should show rewards catalog', async ({ page }) => {
    await page.goto('/rewards');
    await expect(page.locator('text=Available Rewards')).toBeVisible();
  });

  test('should show redeem button for each reward', async ({ page }) => {
    await page.goto('/rewards');
    await expect(page.locator('text=Redeem')).toBeVisible();
  });

  test('should show insufficient balance message', async ({ page }) => {
    await page.goto('/rewards');
    await page.click('text=Redeem');
    await expect(page.locator('text=Insufficient Balance')).toBeVisible();
  });
});
