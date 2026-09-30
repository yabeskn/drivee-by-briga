# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth\session-persist.spec.ts >> Session Persistence >> should show Drifee branding on login page
- Location: e2e\auth\session-persist.spec.ts:4:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Drifee')
Expected: visible
Error: strict mode violation: locator('text=Drifee') resolved to 2 elements:
    1) <span class="text-lg font-semibold text-white">Drifee</span> aka getByText('Drifee', { exact: true })
    2) <p class="text-sm text-zinc-400 mb-4">Use your Google account to sign in to Drifee.</p> aka getByText('Use your Google account to')

Call log:
  - Expect "toBeVisible" locator('text=Drifee') with timeout 5000ms
  - waiting for locator('text=Drifee')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
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
          - textbox "0812xxxxxxx" [ref=e36]
        - button "Send Verification Link" [disabled] [ref=e37]
    - paragraph [ref=e39]: By signing in, you agree to our Terms of Service and Privacy Policy.
  - alert [ref=e40]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Session Persistence', () => {
  4  |   test('should show Drifee branding on login page', async ({ page }) => {
  5  |     await page.goto('/login');
> 6  |     await expect(page.locator('text=Drifee')).toBeVisible({ timeout: 5000 });
     |                                               ^ Error: expect(locator).toBeVisible() failed
  7  |   });
  8  | 
  9  |   test('should show login page elements', async ({ page }) => {
  10 |     await page.goto('/login');
  11 |     await expect(page.locator('text=Sign in with Google')).toBeVisible({ timeout: 5000 });
  12 |     await expect(page.locator('text=Verifikasi Nomor HP')).toBeVisible({ timeout: 5000 });
  13 |   });
  14 | });
  15 | 
```