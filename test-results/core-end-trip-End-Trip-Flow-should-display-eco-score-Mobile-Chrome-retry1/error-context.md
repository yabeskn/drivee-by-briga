# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: core\end-trip.spec.ts >> End Trip Flow >> should display eco score
- Location: e2e\core\end-trip.spec.ts:16:7

# Error details

```
TimeoutError: page.fill: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('input[type="password"]')

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
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('End Trip Flow', () => {
  4   |   test.beforeEach(async ({ page }) => {
  5   |     await page.goto('/login');
  6   |     await page.fill('input[type="tel"]', '081234567890');
> 7   |     await page.fill('input[type="password"]', '123456');
      |                ^ TimeoutError: page.fill: Timeout 10000ms exceeded.
  8   |     await page.click('button:has-text("Masuk")');
  9   |     await page.waitForURL('**/go');
  10  |   });
  11  | 
  12  |   test('should show end trip dashboard', async ({ page }) => {
  13  |     await expect(page.locator('text=Ringkasan Eco-Driving')).toBeVisible();
  14  |   });
  15  | 
  16  |   test('should display eco score', async ({ page }) => {
  17  |     await expect(page.locator('text=ECO SCORE')).toBeVisible();
  18  |     const score = page.locator('text=/^\\d+\\/100$/');
  19  |     await expect(score).toBeVisible();
  20  |   });
  21  | 
  22  |   test('should display trip duration', async ({ page }) => {
  23  |     await expect(page.locator('text=TRIP')).toBeVisible();
  24  |   });
  25  | 
  26  |   test('should display trip distance', async ({ page }) => {
  27  |     await expect(page.locator('text=km')).toBeVisible();
  28  |   });
  29  | 
  30  |   test('should display BrigaCoins earned', async ({ page }) => {
  31  |     await expect(page.locator('text=BrigaCoins')).toBeVisible();
  32  |   });
  33  | 
  34  |   test('should display token breakdown', async ({ page }) => {
  35  |     await expect(page.locator('text=Base Reward')).toBeVisible();
  36  |     await expect(page.locator('text=Multiplier Eco Score')).toBeVisible();
  37  |   });
  38  | 
  39  |   test('should display verification status', async ({ page }) => {
  40  |     await expect(page.locator('text=VERIFIED, REJECTED, or PENDING')).toBeVisible();
  41  |   });
  42  | 
  43  |   test('should display trip hash', async ({ page }) => {
  44  |     await expect(page.locator('text=SHA-256 Hash')).toBeVisible();
  45  |   });
  46  | 
  47  |   test('should copy trip hash', async ({ page }) => {
  48  |     await page.click('button[title="Salin Hash"]');
  49  |     await expect(page.locator('text=Hash copied')).toBeVisible();
  50  |   });
  51  | 
  52  |   test('should navigate to new trip', async ({ page }) => {
  53  |     await page.click('button:has-text("Trip Baru")');
  54  |     await page.waitForURL('**/login');
  55  |   });
  56  | 
  57  |   test('should show sensor diagnostics', async ({ page }) => {
  58  |     await expect(page.locator('text=SENSOR DIAGNOSTIK')).toBeVisible();
  59  |   });
  60  | 
  61  |   test('should show harsh acceleration count', async ({ page }) => {
  62  |     await expect(page.locator('text=Harsh Accel')).toBeVisible();
  63  |   });
  64  | 
  65  |   test('should show harsh brake count', async ({ page }) => {
  66  |     await expect(page.locator('text=Harsh Brake')).toBeVisible();
  67  |   });
  68  | 
  69  |   test('should show max speed', async ({ page }) => {
  70  |     await expect(page.locator('text=max:')).toBeVisible();
  71  |   });
  72  | 
  73  |   test('should show CO2 avoided', async ({ page }) => {
  74  |     await expect(page.locator('text=CO₂ Dihindari')).toBeVisible();
  75  |   });
  76  | 
  77  |   test('should show efficiency', async ({ page }) => {
  78  |     await expect(page.locator('text=kWh/100km')).toBeVisible();
  79  |   });
  80  | 
  81  |   test('should show eco grade', async ({ page }) => {
  82  |     await expect(page.locator('text=Grade:')).toBeVisible();
  83  |   });
  84  | 
  85  |   test('should show profile used', async ({ page }) => {
  86  |     await expect(page.locator('text=Profil:')).toBeVisible();
  87  |   });
  88  | 
  89  |   test('should show start and end SoC', async ({ page }) => {
  90  |     await expect(page.locator('text=Awal:')).toBeVisible();
  91  |     await expect(page.locator('text=Akhir:')).toBeVisible();
  92  |   });
  93  | 
  94  |   test('should show start and end odometer', async ({ page }) => {
  95  |     await expect(page.locator('text=Awal:')).toBeVisible();
  96  |     await expect(page.locator('text=Akhir:')).toBeVisible();
  97  |   });
  98  | 
  99  |   test('should show energy consumption', async ({ page }) => {
  100 |     await expect(page.locator('text=Konsumsi:')).toBeVisible();
  101 |   });
  102 | 
  103 |   test('should show average speed', async ({ page }) => {
  104 |     await expect(page.locator('text=Rata-rata:')).toBeVisible();
  105 |   });
  106 | 
  107 |   test('should show idle duration', async ({ page }) => {
```