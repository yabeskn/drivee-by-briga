# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: core\register-vehicle.spec.ts >> Vehicle Registration >> should have vehicle category selector
- Location: e2e\core\register-vehicle.spec.ts:9:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Vehicle Category')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('text=Vehicle Category') with timeout 5000ms
  - waiting for locator('text=Vehicle Category')

```

```yaml
- link "Drifee":
  - /url: /landing
  - img
  - text: Drifee
- button "🇮🇩 ID"
- button "🇬🇧 EN"
- heading "Vehicle Registration" [level=1]
- paragraph: Complete your EV vehicle information.
- text: 1 2 3 4 5 6
- heading "Vehicle Info" [level=3]
- text: Vehicle Type *
- combobox:
  - option "Select..." [selected]
  - option "MPV"
  - option "Van"
  - option "Bus"
- text: Brand *
- textbox
- text: Model *
- textbox
- text: Year *
- spinbutton
- text: Color *
- textbox
- button "Back" [disabled]
- button "Next"
- alert
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Vehicle Registration', () => {
  4  |   test('should show vehicle registration form', async ({ page }) => {
  5  |     await page.goto('/register/vehicle', { timeout: 10000 });
  6  |     await expect(page.locator('text=Vehicle Registration')).toBeVisible({ timeout: 5000 });
  7  |   });
  8  | 
  9  |   test('should have vehicle category selector', async ({ page }) => {
  10 |     await page.goto('/register/vehicle', { timeout: 10000 });
> 11 |     await expect(page.locator('text=Vehicle Category')).toBeVisible({ timeout: 5000 });
     |                                                         ^ Error: expect(locator).toBeVisible() failed
  12 |   });
  13 | });
  14 | 
```