import { test, expect } from '@playwright/test';

test.describe('Start Trip Flow', () => {
  test('should show vehicle selection or empty state', async ({ page }) => {
    await page.goto('/go', { timeout: 10000 });
    await expect(page.locator('text=No vehicles registered')).toBeVisible({ timeout: 5000 });
  });

  test('should show register vehicle button when empty', async ({ page }) => {
    await page.goto('/go', { timeout: 10000 });
    await expect(page.locator('text=Register Vehicle')).toBeVisible({ timeout: 5000 });
  });
});
