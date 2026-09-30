import { test, expect } from '@playwright/test';

test.describe('End Trip Flow', () => {
  test('should show end trip dashboard or empty state', async ({ page }) => {
    await page.goto('/go');
    await expect(page.locator('text=Tidak Ada Data Perjalanan')).toBeVisible({ timeout: 5000 });
  });
});
