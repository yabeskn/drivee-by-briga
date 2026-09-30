# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: core\start-trip.spec.ts >> Start Trip Flow >> should show vehicle selection or empty state
- Location: e2e\core\start-trip.spec.ts:4:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Tidak ada kendaraan terdaftar')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('text=Tidak ada kendaraan terdaftar') with timeout 5000ms
  - waiting for locator('text=Tidak ada kendaraan terdaftar')

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
> 6  |     await expect(page.locator('text=Tidak ada kendaraan terdaftar')).toBeVisible({ timeout: 5000 });
     |                                                                      ^ Error: expect(locator).toBeVisible() failed
  7  |   });
  8  | 
  9  |   test('should show register vehicle button when empty', async ({ page }) => {
  10 |     await page.goto('/go', { timeout: 10000 });
  11 |     await expect(page.locator('text=Daftar Kendaraan')).toBeVisible({ timeout: 5000 });
  12 |   });
  13 | });
  14 | 
```