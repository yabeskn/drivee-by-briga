import { test, expect } from '@playwright/test';

test.describe('Session Persistence', () => {
  test('should show Drifee branding on login page', async ({ page }) => {
    await page.goto('/login', { timeout: 10000 });
    await expect(page.locator('text=Drifee')).toBeVisible({ timeout: 5000 });
  });

  test('should show login page elements', async ({ page }) => {
    await page.goto('/login', { timeout: 10000 });
    await expect(page.locator('text=Sign in with Google')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Verify Phone Number')).toBeVisible({ timeout: 5000 });
  });
});
