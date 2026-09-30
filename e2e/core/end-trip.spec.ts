import { test, expect } from '@playwright/test';

test.describe('End Trip Flow', () => {
  test('should show end trip dashboard or empty state', async ({ page }) => {
    await page.goto('/go', { timeout: 10000 });
    await expect(page.locator('text=No Trip Data')).toBeVisible({ timeout: 5000 });
  });
});
