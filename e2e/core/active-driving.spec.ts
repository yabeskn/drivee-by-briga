import { test, expect } from '@playwright/test';

test.describe('Active Driving HUD', () => {
  test('should show HUD elements', async ({ page }) => {
    await page.goto('/go');
    await expect(page.locator('text=Drive, Earn, and Track')).toBeVisible();
  });

  test('should show three pillars', async ({ page }) => {
    await page.goto('/go');
    await expect(page.locator('text=Drive')).toBeVisible();
    await expect(page.locator('text=Earn')).toBeVisible();
    await expect(page.locator('text=Track')).toBeVisible();
  });

  test('should show tagline badge', async ({ page }) => {
    await page.goto('/go');
    await expect(page.locator('text=Drive, Earn, and Track safely')).toBeVisible();
  });
});
