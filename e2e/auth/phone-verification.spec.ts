import { test, expect } from '@playwright/test';

test.describe('Phone Verification', () => {
  test('should show phone input and send button', async ({ page }) => {
    await page.goto('/login', { timeout: 10000 });
    await expect(page.locator('input[type="tel"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Send Verification Link')).toBeVisible({ timeout: 5000 });
  });

  test('should accept valid phone number', async ({ page }) => {
    await page.goto('/login', { timeout: 10000 });
    await page.fill('input[type="tel"]', '081234567890');
    await page.click('text=Send Verification Link');
    await expect(page.locator('text=Verification link sent')).toBeVisible({ timeout: 5000 });
  });
});
