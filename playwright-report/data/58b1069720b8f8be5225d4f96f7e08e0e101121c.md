# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pwa\install-prompt.spec.ts >> PWA Install Prompt >> should show install banner
- Location: e2e\pwa\install-prompt.spec.ts:4:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Install Drifee')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('text=Install Drifee') with timeout 5000ms
  - waiting for locator('text=Install Drifee')

```

```yaml
- navigation:
  - link "Drifeeby Briga":
    - /url: /landing
    - img
    - text: Drifeeby Briga
  - button "🇮🇩 ID"
  - button "🇬🇧 EN"
  - link "Register":
    - /url: /register/driver
- main:
  - text: Drive, Earn, and Track safely
  - heading "Drive, Earn, and Track" [level=1]
  - paragraph: Smart EV Fleet Telematics Platform
  - img
  - heading "Drive" [level=3]
  - paragraph: GPS tracking real-time untuk setiap perjalanan
  - img
  - heading "Earn" [level=3]
  - paragraph: BrigaCoins untuk setiap perjalanan eco-friendly
  - img
  - heading "Track" [level=3]
  - paragraph: Pantau emisi karbon & skor eco-driving
  - link "Login":
    - /url: /login
  - link "Register":
    - /url: /register/driver
  - heading "Cara Kerja Kami" [level=2]
  - paragraph: Tiga pilar value proposition Drifee
  - img
  - heading "Drive" [level=3]
  - paragraph: GPS tracking real-time, dynamic polling, dan WakeLock untuk perjalanan yang aman dan efisien.
  - img
  - heading "Earn" [level=3]
  - paragraph: BrigaCoins untuk setiap perjalanan eco-friendly. Skor tinggi = reward lebih besar.
  - img
  - heading "Track" [level=3]
  - paragraph: Pantau emisi karbon, skor eco-driving, dan riwayat perjalanan secara transparan.
  - heading "How It Works" [level=2]
  - paragraph: Get started in 4 easy steps
  - text: "1"
  - heading "Register" [level=3]
  - paragraph: Fill in driver and vehicle registration forms.
  - text: "2"
  - heading "Install PWA" [level=3]
  - paragraph: Add Drifee to your smartphone home screen.
  - text: "3"
  - heading "Start Trip" [level=3]
  - paragraph: Open the app and start your journey.
  - text: "4"
  - heading "Earn Rewards" [level=3]
  - paragraph: Receive BrigaCoins after trip completion.
  - heading "Platform Statistics" [level=2]
  - text: 10K+ Total Trips 500T CO₂ Saved 500+ Active Drivers 200+ Registered Vehicles
  - heading "Ready to join Drifee?" [level=2]
  - paragraph: Register as a driver or vehicle and start earning rewards.
  - link "Register Driver":
    - /url: /register/driver
  - link "Register Vehicle":
    - /url: /register/vehicle
- contentinfo:
  - img
  - text: Drifeeby Briga
  - paragraph: Smart EV fleet telematics platform for eco-driving and rewards.
  - heading "Product" [level=4]
  - list:
    - listitem:
      - link "Features":
        - /url: "#features"
    - listitem:
      - link "How It Works":
        - /url: "#how-it-works"
    - listitem:
      - link "Register Driver":
        - /url: /register/driver
    - listitem:
      - link "Register Vehicle":
        - /url: /register/vehicle
  - heading "Company" [level=4]
  - list:
    - listitem:
      - link "Contact":
        - /url: "#"
    - listitem:
      - link "Privacy Policy":
        - /url: "#"
    - listitem:
      - link "Terms & Conditions":
        - /url: "#"
  - text: © 2026 Drifee by Briga. PT Briga Energi Indonesia.
- alert
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('PWA Install Prompt', () => {
  4  |   test('should show install banner', async ({ page }) => {
  5  |     await page.goto('/', { timeout: 10000 });
> 6  |     await expect(page.locator('text=Install Drifee')).toBeVisible({ timeout: 5000 });
     |                                                       ^ Error: expect(locator).toBeVisible() failed
  7  |   });
  8  | 
  9  |   test('should have install button', async ({ page }) => {
  10 |     await page.goto('/', { timeout: 10000 });
  11 |     await expect(page.locator('text=Install')).toBeVisible({ timeout: 5000 });
  12 |   });
  13 | });
  14 | 
```