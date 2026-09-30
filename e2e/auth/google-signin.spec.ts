import { test, expect } from '@playwright/test';

test.describe('Google Sign-In', () => {
  test('should show login page with Google Sign-In button', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=Sign in with Google')).toBeVisible();
  });

  test('should redirect to Google OAuth on click', async ({ page }) => {
    await page.goto('/login');
    await page.click('text=Sign in with Google');
    await page.waitForURL(/accounts\.google\.com/, { timeout: 10_000 });
  });

  test('should show phone verification section', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=Verify Phone Number')).toBeVisible();
  });

  test('should have phone input field', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="tel"]')).toBeVisible();
  });
});
