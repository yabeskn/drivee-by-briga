# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: core\start-trip.spec.ts >> Start Trip Flow >> should show register vehicle button when empty
- Location: e2e\core\start-trip.spec.ts:9:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Register Vehicle')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('text=Register Vehicle') with timeout 5000ms
  - waiting for locator('text=Register Vehicle')

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
  3  | test.describe('Start Trip Flow', () => {
  4  |   test('should show vehicle selection or empty state', async ({ page }) => {
  5  |     await page.goto('/go', { timeout: 10000 });
  6  |     await expect(page.locator('text=No vehicles registered')).toBeVisible({ timeout: 5000 });
  7  |   });
  8  | 
  9  |   test('should show register vehicle button when empty', async ({ page }) => {
  10 |     await page.goto('/go', { timeout: 10000 });
> 11 |     await expect(page.locator('text=Register Vehicle')).toBeVisible({ timeout: 5000 });
     |                                                         ^ Error: expect(locator).toBeVisible() failed
  12 |   });
  13 | });
  14 | 
```