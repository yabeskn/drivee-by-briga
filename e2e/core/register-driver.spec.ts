import { test, expect } from '@playwright/test';

test.describe('Driver Registration', () => {
  test('should show registration form', async ({ page }) => {
    await page.goto('/register/driver');
    await expect(page.locator('text=Pendaftaran Driver')).toBeVisible({ timeout: 5000 });
  });

  test('should have all required fields', async ({ page }) => {
    await page.goto('/register/driver');
    await expect(page.locator('input[type="tel"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5000 });
  });
});
