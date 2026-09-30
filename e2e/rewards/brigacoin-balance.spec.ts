import { test, expect } from '@playwright/test';

test.describe('BrigaCoin Balance', () => {
  test('should show BRC balance section', async ({ page }) => {
    await page.goto('/rewards');
    await expect(page.locator('text=BrigaCoin Balance')).toBeVisible();
  });

  test('should show 0 BRC when no data', async ({ page }) => {
    await page.goto('/rewards');
    await expect(page.locator('text=0 BRC')).toBeVisible();
  });

  test('should show available rewards', async ({ page }) => {
    await page.goto('/rewards');
    await expect(page.locator('text=Available Rewards')).toBeVisible();
  });
});
