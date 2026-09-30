import { test, expect } from '@playwright/test';

test.describe('Google Sign-In', () => {
  test('should show login page with Google Sign-In button', async ({ page }) => {
    await page.goto('/login', { timeout: 10000 });
    await expect(page.locator('text=Sign in with Google')).toBeVisible({ timeout: 5000 });
  });

  test('should show phone verification section', async ({ page }) => {
    await page.goto('/login', { timeout: 10000 });
    await expect(page.locator('text=Verify Phone Number')).toBeVisible({ timeout: 5000 });
  });

  test('should have phone input field', async ({ page }) => {
    await page.goto('/login', { timeout: 10000 });
    await expect(page.locator('input[type="tel"]')).toBeVisible({ timeout: 5000 });
  });
});
