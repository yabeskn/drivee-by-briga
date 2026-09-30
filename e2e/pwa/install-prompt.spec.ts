import { test, expect } from '@playwright/test';

test.describe('PWA Install Prompt', () => {
  test('should show install banner', async ({ page }) => {
    await page.goto('/', { timeout: 10000 });
    await expect(page.locator('text=Install Drifee')).toBeVisible({ timeout: 5000 });
  });

  test('should have install button', async ({ page }) => {
    await page.goto('/', { timeout: 10000 });
    await expect(page.locator('text=Install')).toBeVisible({ timeout: 5000 });
  });
});
