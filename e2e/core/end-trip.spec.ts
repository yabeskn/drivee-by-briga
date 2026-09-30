import { test, expect } from '@playwright/test';

test.describe('End Trip Flow', () => {
  test('should show end trip dashboard', async ({ page }) => {
    await page.goto('/go');
    await expect(page.locator('text=No Trip Data')).toBeVisible();
  });

  test('should show start new trip button', async ({ page }) => {
    await page.goto('/go');
    await expect(page.locator('text=Start New Trip')).toBeVisible();
  });

  test('should navigate to login on start new trip', async ({ page }) => {
    await page.goto('/go');
    await page.click('text=Start New Trip');
    await page.waitForURL('**/login');
  });
});
