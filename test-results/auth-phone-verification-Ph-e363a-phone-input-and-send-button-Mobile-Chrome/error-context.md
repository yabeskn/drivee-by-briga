# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth\phone-verification.spec.ts >> Phone Verification >> should show phone input and send button
- Location: e2e\auth\phone-verification.spec.ts:4:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Kirim Link Verifikasi')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('text=Kirim Link Verifikasi') with timeout 5000ms
  - waiting for locator('text=Kirim Link Verifikasi')

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
  3  | test.describe('Phone Verification', () => {
  4  |   test('should show phone input and send button', async ({ page }) => {
  5  |     await page.goto('/login');
  6  |     await expect(page.locator('input[type="tel"]')).toBeVisible({ timeout: 5000 });
> 7  |     await expect(page.locator('text=Kirim Link Verifikasi')).toBeVisible({ timeout: 5000 });
     |                                                              ^ Error: expect(locator).toBeVisible() failed
  8  |   });
  9  | 
  10 |   test('should accept valid phone number', async ({ page }) => {
  11 |     await page.goto('/login');
  12 |     await page.fill('input[type="tel"]', '081234567890');
  13 |     await page.click('text=Kirim Link Verifikasi');
  14 |     await expect(page.locator('text=Link verifikasi terkirim')).toBeVisible({ timeout: 5000 });
  15 |   });
  16 | });
  17 | 
```