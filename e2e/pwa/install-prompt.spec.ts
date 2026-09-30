import { test, expect } from '@playwright/test';

test.describe('PWA Install Prompt', () => {
  test('should show install banner', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Install Drifee')).toBeVisible();
  });

  test('should have install button', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Install')).toBeVisible();
  });

  test('should have dismiss button', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Later')).toBeVisible();
  });
});
