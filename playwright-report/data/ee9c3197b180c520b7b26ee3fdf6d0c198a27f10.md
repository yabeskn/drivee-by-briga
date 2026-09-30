# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: offline\sync-recovery.spec.ts >> Sync Recovery >> should show connection restored when back online
- Location: e2e\offline\sync-recovery.spec.ts:4:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Connection restored')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('text=Connection restored') with timeout 5000ms
  - waiting for locator('text=Connection restored')

```

```yaml
- paragraph: Please login first
- link "Go to Login":
  - /url: /login
- alert
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Sync Recovery', () => {
  4  |   test('should show connection restored when back online', async ({ page, context }) => {
  5  |     await page.goto('/go', { timeout: 10000 });
  6  |     await context.setOffline(true);
  7  |     await context.setOffline(false);
> 8  |     await expect(page.locator('text=Connection restored')).toBeVisible({ timeout: 5000 });
     |                                                            ^ Error: expect(locator).toBeVisible() failed
  9  |   });
  10 | });
  11 | 
```