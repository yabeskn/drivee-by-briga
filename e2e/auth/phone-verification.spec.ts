import { test, expect } from '@playwright/test';

test.describe('Phone Verification', () => {
  test('should show phone input and send button', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="tel"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Kirim Link Verifikasi')).toBeVisible({ timeout: 5000 });
  });

  test('should accept valid phone number', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="tel"]', '081234567890');
    await page.click('text=Kirim Link Verifikasi');
    await expect(page.locator('text=Link verifikasi terkirim')).toBeVisible({ timeout: 5000 });
  });
});
