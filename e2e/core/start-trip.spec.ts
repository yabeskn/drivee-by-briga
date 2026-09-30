import { test, expect } from '@playwright/test';

test.describe('Start Trip Flow', () => {
  test('should show vehicle selection', async ({ page }) => {
    await page.goto('/go');
    await expect(page.locator('text=Select Vehicle')).toBeVisible();
  });

  test('should show no vehicles message when empty', async ({ page }) => {
    await page.goto('/go');
    await expect(page.locator('text=No vehicles registered')).toBeVisible();
  });

  test('should show register vehicle button when empty', async ({ page }) => {
    await page.goto('/go');
    await expect(page.locator('text=Register Vehicle')).toBeVisible();
  });

  test('should navigate to register vehicle', async ({ page }) => {
    await page.goto('/go');
    await page.click('text=Register Vehicle');
    await page.waitForURL('**/register/vehicle');
  });
});
