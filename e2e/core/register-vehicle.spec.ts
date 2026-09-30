import { test, expect } from '@playwright/test';
import { testVehicleData } from '../fixtures/test-vehicle';

test.describe('Vehicle Registration', () => {
  test('should show vehicle registration form', async ({ page }) => {
    await page.goto('/register/vehicle');
    await expect(page.locator('text=Vehicle Registration')).toBeVisible();
  });

  test('should have vehicle category selector', async ({ page }) => {
    await page.goto('/register/vehicle');
    await expect(page.locator('text=Vehicle Category')).toBeVisible();
  });

  test('should have all required fields', async ({ page }) => {
    await page.goto('/register/vehicle');
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/register/vehicle');
    await page.click('text=Register Vehicle');
    await expect(page.locator('text=required')).toBeVisible();
  });

  test('should accept valid vehicle data', async ({ page }) => {
    await page.goto('/register/vehicle');
    await page.selectOption('select', testVehicleData.category);
    await page.fill('input[type="text"] >> nth=0', testVehicleData.brand);
    await page.fill('input[type="text"] >> nth=1', testVehicleData.model);
    await page.fill('input[type="text"] >> nth=2', testVehicleData.licensePlate);
    await page.click('text=Register Vehicle');
    await expect(page.locator('text=Vehicle registered')).toBeVisible();
  });
});
