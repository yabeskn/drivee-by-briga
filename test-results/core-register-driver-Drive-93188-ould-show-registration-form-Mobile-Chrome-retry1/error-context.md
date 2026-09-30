# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: core\register-driver.spec.ts >> Driver Registration >> should show registration form
- Location: e2e\core\register-driver.spec.ts:4:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Pendaftaran Driver')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('text=Pendaftaran Driver') with timeout 5000ms
  - waiting for locator('text=Pendaftaran Driver')

```

```yaml
- link "Drifee":
  - /url: /landing
  - img
  - text: Drifee
- button "🇮🇩 ID"
- button "🇬🇧 EN"
- heading "Driver Registration" [level=1]
- paragraph: Complete your personal information to join Drifee.
- text: 1 2 3 4 5
- heading "Personal Info" [level=3]
- text: Full Name *
- textbox
- text: National ID *
- textbox
- text: Phone Number *
- textbox
- text: Email *
- textbox
- text: Address *
- textbox
- button "Back" [disabled]
- button "Next"
- alert
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Driver Registration', () => {
  4  |   test('should show registration form', async ({ page }) => {
  5  |     await page.goto('/register/driver', { timeout: 10000 });
> 6  |     await expect(page.locator('text=Pendaftaran Driver')).toBeVisible({ timeout: 5000 });
     |                                                           ^ Error: expect(locator).toBeVisible() failed
  7  |   });
  8  | 
  9  |   test('should have all required fields', async ({ page }) => {
  10 |     await page.goto('/register/driver', { timeout: 10000 });
  11 |     await expect(page.locator('input[type="tel"]')).toBeVisible({ timeout: 5000 });
  12 |     await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5000 });
  13 |   });
  14 | });
  15 | 
```