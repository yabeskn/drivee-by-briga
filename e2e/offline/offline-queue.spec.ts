import { test, expect } from '@playwright/test';

test.describe('Offline Queue', () => {
  test('should show offline indicator when offline', async ({ page, context }) => {
    await page.goto('/go', { timeout: 10000 });
    await context.setOffline(true);
    await expect(page.locator('text=Connection lost')).toBeVisible({ timeout: 5000 });
  });
});
