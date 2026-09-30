import { test, expect } from '@playwright/test';

test.describe('Start Trip Flow', () => {
  test('should show vehicle selection or empty state', async ({ page }) => {
    await page.goto('/go');
    await expect(page.locator('text=Tidak ada kendaraan terdaftar')).toBeVisible({ timeout: 5000 });
  });

  test('should show register vehicle button when empty', async ({ page }) => {
    await page.goto('/go');
    await expect(page.locator('text=Daftar Kendaraan')).toBeVisible({ timeout: 5000 });
  });
});
