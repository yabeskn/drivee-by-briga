# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth\phone-verification.spec.ts >> Phone Verification >> should accept valid phone number
- Location: e2e\auth\phone-verification.spec.ts:10:7

# Error details

```
TimeoutError: page.click: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('text=Kirim Link Verifikasi')

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - img [ref=e7]:
          - generic [ref=e13]: $
        - generic [ref=e15]: Drifee
      - generic [ref=e16]:
        - button "🇮🇩 ID" [ref=e17] [cursor=pointer]
        - button "🇬🇧 EN" [ref=e18] [cursor=pointer]
    - generic [ref=e19]:
      - heading "Sign in with Google" [level=2] [ref=e20]
      - paragraph [ref=e21]: Use your Google account to sign in to Drifee.
      - button "Sign in with Google" [ref=e23] [cursor=pointer]
    - generic [ref=e30]:
      - heading "Verify Phone Number" [level=2] [ref=e31]
      - paragraph [ref=e32]: Enter your WhatsApp number to receive a verification link.
      - generic [ref=e33]:
        - generic [ref=e34]:
          - generic [ref=e35]: Phone Number
          - textbox "0812xxxxxxx" [active] [ref=e36]: "081234567890"
        - button "Send Verification Link" [ref=e37] [cursor=pointer]
    - paragraph [ref=e39]: By signing in, you agree to our Terms of Service and Privacy Policy.
  - alert [ref=e40]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Phone Verification', () => {
  4  |   test('should show phone input and send button', async ({ page }) => {
  5  |     await page.goto('/login');
  6  |     await expect(page.locator('input[type="tel"]')).toBeVisible({ timeout: 5000 });
  7  |     await expect(page.locator('text=Kirim Link Verifikasi')).toBeVisible({ timeout: 5000 });
  8  |   });
  9  | 
  10 |   test('should accept valid phone number', async ({ page }) => {
  11 |     await page.goto('/login');
  12 |     await page.fill('input[type="tel"]', '081234567890');
> 13 |     await page.click('text=Kirim Link Verifikasi');
     |                ^ TimeoutError: page.click: Timeout 10000ms exceeded.
  14 |     await expect(page.locator('text=Link verifikasi terkirim')).toBeVisible({ timeout: 5000 });
  15 |   });
  16 | });
  17 | 
```