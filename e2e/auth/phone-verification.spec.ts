import { test, expect } from '@playwright/test';

test.describe('Phone Verification', () => {
  test('should show phone input and send button', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="tel"]')).toBeVisible();
    await expect(page.locator('text=Send Verification Link')).toBeVisible();
  });

  test('should validate phone number format', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="tel"]', '123');
    await page.click('text=Send Verification Link');
    await expect(page.locator('text=Phone number is required')).toBeVisible();
  });

  test('should accept valid phone number', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="tel"]', '081234567890');
    await page.click('text=Send Verification Link');
    await expect(page.locator('text=Verification link sent')).toBeVisible();
  });
});
