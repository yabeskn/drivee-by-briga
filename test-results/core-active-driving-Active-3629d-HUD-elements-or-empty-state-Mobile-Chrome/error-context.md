# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: core\active-driving.spec.ts >> Active Driving HUD >> should show HUD elements or empty state
- Location: e2e\core\active-driving.spec.ts:4:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=No Trip Data')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('text=No Trip Data') with timeout 5000ms
  - waiting for locator('text=No Trip Data')

```

```yaml
- paragraph: Please login first
- link "Go to Login":
  - /url: /login
- alert
```

# Test source

```ts
  1 | import { test, expect } from '@playwright/test';
  2 | 
  3 | test.describe('Active Driving HUD', () => {
  4 |   test('should show HUD elements or empty state', async ({ page }) => {
  5 |     await page.goto('/go', { timeout: 10000 });
> 6 |     await expect(page.locator('text=No Trip Data')).toBeVisible({ timeout: 5000 });
    |                                                     ^ Error: expect(locator).toBeVisible() failed
  7 |   });
  8 | });
  9 | 
```