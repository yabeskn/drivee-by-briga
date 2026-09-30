import { test, expect } from '@playwright/test';

test.describe('Sync Recovery', () => {
  test('should show connection restored when back online', async ({ page, context }) => {
    await page.goto('/go', { timeout: 10000 });
    await context.setOffline(true);
    await context.setOffline(false);
    await expect(page.locator('text=Connection restored')).toBeVisible({ timeout: 5000 });
  });
});
