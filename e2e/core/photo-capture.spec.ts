import { test, expect } from '@playwright/test';

test.describe('Photo Capture - Anti-Spoofing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    // Login first
    await page.fill('input[type="tel"]', '081234567890');
    await page.fill('input[type="password"]', '123456');
    await page.click('button:has-text("Masuk")');
    await page.waitForURL('**/go');
  });

  test('should show photo capture section', async ({ page }) => {
    await expect(page.locator('text=Bukti Foto')).toBeVisible();
  });

  test('should have odometer photo upload', async ({ page }) => {
    const odometerInput = page.locator('input[type="file"][accept*="image"]').first();
    await expect(odometerInput).toBeVisible();
  });

  test('should have battery photo upload', async ({ page }) => {
    const batteryInput = page.locator('input[type="file"][accept*="image"]').nth(1);
    await expect(batteryInput).toBeVisible();
  });

  test('should upload odometer photo', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'odometer.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-data'),
    });
    await expect(page.locator('text=Foto Odometer uploaded')).toBeVisible();
  });

  test('should upload battery photo', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').nth(1);
    await fileInput.setInputFiles({
      name: 'battery.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-data'),
    });
    await expect(page.locator('text=Foto Baterai uploaded')).toBeVisible();
  });

  test('should show preview after upload', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'odometer.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-data'),
    });
    await expect(page.locator('img[alt="Preview"]')).toBeVisible();
  });

  test('should require both photos before submit', async ({ page }) => {
    const submitBtn = page.locator('button:has-text("Kirim")');
    await expect(submitBtn).toBeDisabled();
  });

  test('should enable submit after both photos uploaded', async ({ page }) => {
    // Upload odometer
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'odometer.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-data'),
    });
    // Upload battery
    await page.locator('input[type="file"]').nth(1).setInputFiles({
      name: 'battery.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-data'),
    });
    const submitBtn = page.locator('button:has-text("Kirim")');
    await expect(submitBtn).toBeEnabled();
  });

  test('should validate photo file size', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    // Create a large file (>1MB)
    const largeBuffer = Buffer.alloc(2 * 1024 * 1024, 'a');
    await fileInput.setInputFiles({
      name: 'large.jpg',
      mimeType: 'image/jpeg',
      buffer: largeBuffer,
    });
    await expect(page.locator('text=File terlalu besar')).toBeVisible();
  });

  test('should validate photo file type', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('fake-pdf-data'),
    });
    await expect(page.locator('text=Format file tidak valid')).toBeVisible();
  });

  test('should allow retake photo', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'odometer.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-data'),
    });
    await page.click('button:has-text("Retake")');
    await expect(page.locator('input[type="file"]').first()).toBeVisible();
  });
});
