import { test, expect } from '@playwright/test';

test.describe('Vehicle Registration', () => {
  test('should show vehicle registration form', async ({ page }) => {
    await page.goto('/register/vehicle', { timeout: 10000 });
    await expect(page.locator('text=Vehicle Registration')).toBeVisible({ timeout: 5000 });
  });

  test('should have vehicle category selector', async ({ page }) => {
    await page.goto('/register/vehicle', { timeout: 10000 });
    await expect(page.locator('text=Vehicle Category')).toBeVisible({ timeout: 5000 });
  });
});
