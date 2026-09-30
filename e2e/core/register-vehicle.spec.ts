import { test, expect } from '@playwright/test';

test.describe('Vehicle Registration', () => {
  test('should show vehicle registration form', async ({ page }) => {
    await page.goto('/register/vehicle');
    await expect(page.locator('text=Pendaftaran Kendaraan')).toBeVisible({ timeout: 5000 });
  });

  test('should have vehicle category selector', async ({ page }) => {
    await page.goto('/register/vehicle');
    await expect(page.locator('text=Kategori Kendaraan')).toBeVisible({ timeout: 5000 });
  });
});
