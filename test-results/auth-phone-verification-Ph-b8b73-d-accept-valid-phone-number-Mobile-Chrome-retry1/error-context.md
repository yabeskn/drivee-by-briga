# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth\phone-verification.spec.ts >> Phone Verification >> should accept valid phone number
- Location: e2e\auth\phone-verification.spec.ts:10:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Verification link sent')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('text=Verification link sent') with timeout 5000ms
  - waiting for locator('text=Verification link sent')

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
- textbox "0812xxxxxxx": "081234567890"
- button "Send Verification Link"
- text: Verification link generated (WhatsApp not available)
- paragraph: By signing in, you agree to our Terms of Service and Privacy Policy.
- alert
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Phone Verification', () => {
  4  |   test('should show phone input and send button', async ({ page }) => {
  5  |     await page.goto('/login', { timeout: 10000 });
  6  |     await expect(page.locator('input[type="tel"]')).toBeVisible({ timeout: 5000 });
  7  |     await expect(page.locator('text=Send Verification Link')).toBeVisible({ timeout: 5000 });
  8  |   });
  9  | 
  10 |   test('should accept valid phone number', async ({ page }) => {
  11 |     await page.goto('/login', { timeout: 10000 });
  12 |     await page.fill('input[type="tel"]', '081234567890');
  13 |     await page.click('text=Send Verification Link');
> 14 |     await expect(page.locator('text=Verification link sent')).toBeVisible({ timeout: 5000 });
     |                                                               ^ Error: expect(locator).toBeVisible() failed
  15 |   });
  16 | });
  17 | 
```