# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth\google-signin.spec.ts >> Google Sign-In >> should show phone verification section
- Location: e2e\auth\google-signin.spec.ts:9:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Verifikasi Nomor HP')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('text=Verifikasi Nomor HP') with timeout 5000ms
  - waiting for locator('text=Verifikasi Nomor HP')

```

```yaml
- img: $
- text: Drifee
- button "🇮🇩 ID"
- button "🇬🇧 EN"
- heading "Sign in with Google" [level=2]
- paragraph: Use your Google account to sign in to Drifee.
- button "Sign in with Google":
  - img
  - text: Sign in with Google
- heading "Verify Phone Number" [level=2]
- paragraph: Enter your WhatsApp number to receive a verification link.
- text: Phone Number
- textbox "0812xxxxxxx"
- button "Send Verification Link" [disabled]
- paragraph: By signing in, you agree to our Terms of Service and Privacy Policy.
- alert
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Google Sign-In', () => {
  4  |   test('should show login page with Google Sign-In button', async ({ page }) => {
  5  |     await page.goto('/login');
  6  |     await expect(page.locator('text=Sign in with Google')).toBeVisible({ timeout: 5000 });
  7  |   });
  8  | 
  9  |   test('should show phone verification section', async ({ page }) => {
  10 |     await page.goto('/login');
> 11 |     await expect(page.locator('text=Verifikasi Nomor HP')).toBeVisible({ timeout: 5000 });
     |                                                            ^ Error: expect(locator).toBeVisible() failed
  12 |   });
  13 | 
  14 |   test('should have phone input field', async ({ page }) => {
  15 |     await page.goto('/login');
  16 |     await expect(page.locator('input[type="tel"]')).toBeVisible({ timeout: 5000 });
  17 |   });
  18 | });
  19 | 
```