import { test, expect } from '@playwright/test';

test.describe('Session Persistence', () => {
  test('should persist login state on refresh', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="tel"]', '081234567890');
    await page.click('text=Send Verification Link');
    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.locator('text=Drifee')).toBeVisible();
  });

  test('should show user name after login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="tel"]', '081234567890');
    await page.click('text=Send Verification Link');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Driver')).toBeVisible();
  });
});
