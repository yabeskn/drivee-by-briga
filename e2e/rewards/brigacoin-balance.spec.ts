import { test, expect } from '@playwright/test';

test.describe('BrigaCoin Balance', () => {
  test('should show BRC balance section', async ({ page }) => {
    await page.goto('/rewards');
    await expect(page.locator('text=Saldo BrigaCoin')).toBeVisible({ timeout: 5000 });
  });

  test('should show 0 BRC when no data', async ({ page }) => {
    await page.goto('/rewards');
    await expect(page.locator('text=0 BRC')).toBeVisible({ timeout: 5000 });
  });
});
