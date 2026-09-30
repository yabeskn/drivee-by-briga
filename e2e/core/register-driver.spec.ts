import { test, expect } from '@playwright/test';
import { testDriver } from '../fixtures/test-driver';

test.describe('Driver Registration', () => {
  test('should show registration form', async ({ page }) => {
    await page.goto('/register/driver');
    await expect(page.locator('text=Driver Registration')).toBeVisible();
  });

  test('should have all required fields', async ({ page }) => {
    await page.goto('/register/driver');
    await expect(page.locator('input[type="tel"]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/register/driver');
    await page.click('text=Submit');
    await expect(page.locator('text=required')).toBeVisible();
  });

  test('should accept valid driver data', async ({ page }) => {
    await page.goto('/register/driver');
    await page.fill('input[type="tel"]', testDriver.phone);
    await page.fill('input[type="email"]', testDriver.email);
    await page.click('text=Submit');
    await expect(page.locator('text=Registration successful')).toBeVisible();
  });
});
