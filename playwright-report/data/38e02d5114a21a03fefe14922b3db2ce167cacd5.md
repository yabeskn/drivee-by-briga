# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pwa\service-worker.spec.ts >> Service Worker >> should register service worker
- Location: e2e\pwa\service-worker.spec.ts:4:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - navigation [ref=e3]:
      - generic [ref=e5]:
        - link "Drifeeby Briga" [ref=e6] [cursor=pointer]:
          - /url: /landing
        - generic [ref=e15]:
          - generic [ref=e16]:
            - button "🇮🇩 ID" [ref=e17] [cursor=pointer]
            - button "🇬🇧 EN" [ref=e18] [cursor=pointer]
          - link "Register" [ref=e19] [cursor=pointer]:
            - /url: /register/driver
    - main [ref=e20]:
      - generic [ref=e23]:
        - generic [ref=e24]: Drive, Earn, and Track safely
        - heading "Drive, Earn, and Track" [level=1] [ref=e27]
        - paragraph [ref=e28]: Smart EV Fleet Telematics Platform
        - generic [ref=e29]:
          - generic [ref=e30]:
            - heading "Drive" [level=3] [ref=e34]
            - paragraph [ref=e35]: GPS tracking real-time untuk setiap perjalanan
          - generic [ref=e36]:
            - heading "Earn" [level=3] [ref=e40]
            - paragraph [ref=e41]: BrigaCoins untuk setiap perjalanan eco-friendly
          - generic [ref=e42]:
            - heading "Track" [level=3] [ref=e46]
            - paragraph [ref=e47]: Pantau emisi karbon & skor eco-driving
        - generic [ref=e48]:
          - link "Login" [ref=e49] [cursor=pointer]:
            - /url: /login
          - link "Register" [ref=e50] [cursor=pointer]:
            - /url: /register/driver
      - generic [ref=e52]:
        - generic [ref=e53]:
          - heading "Cara Kerja Kami" [level=2] [ref=e54]
          - paragraph [ref=e55]: Tiga pilar value proposition Drifee
        - generic [ref=e56]:
          - generic [ref=e57]:
            - heading "Drive" [level=3] [ref=e61]
            - paragraph [ref=e62]: GPS tracking real-time, dynamic polling, dan WakeLock untuk perjalanan yang aman dan efisien.
          - generic [ref=e63]:
            - heading "Earn" [level=3] [ref=e67]
            - paragraph [ref=e68]: BrigaCoins untuk setiap perjalanan eco-friendly. Skor tinggi = reward lebih besar.
          - generic [ref=e69]:
            - heading "Track" [level=3] [ref=e73]
            - paragraph [ref=e74]: Pantau emisi karbon, skor eco-driving, dan riwayat perjalanan secara transparan.
      - generic [ref=e76]:
        - generic [ref=e77]:
          - heading "How It Works" [level=2] [ref=e78]
          - paragraph [ref=e79]: Get started in 4 easy steps
        - generic [ref=e80]:
          - generic [ref=e81]:
            - generic [ref=e86]: "1"
            - heading "Register" [level=3] [ref=e87]
            - paragraph [ref=e88]: Fill in driver and vehicle registration forms.
          - generic [ref=e89]:
            - generic [ref=e94]: "2"
            - heading "Install PWA" [level=3] [ref=e95]
            - paragraph [ref=e96]: Add Drifee to your smartphone home screen.
          - generic [ref=e97]:
            - generic [ref=e101]: "3"
            - heading "Start Trip" [level=3] [ref=e102]
            - paragraph [ref=e103]: Open the app and start your journey.
          - generic [ref=e104]:
            - generic [ref=e110]: "4"
            - heading "Earn Rewards" [level=3] [ref=e111]
            - paragraph [ref=e112]: Receive BrigaCoins after trip completion.
      - generic [ref=e114]:
        - heading "Platform Statistics" [level=2] [ref=e116]
        - generic [ref=e117]:
          - generic [ref=e118]:
            - generic [ref=e119]: 10K+
            - generic [ref=e120]: Total Trips
          - generic [ref=e121]:
            - generic [ref=e122]: 500T
            - generic [ref=e123]: CO₂ Saved
          - generic [ref=e124]:
            - generic [ref=e125]: 500+
            - generic [ref=e126]: Active Drivers
          - generic [ref=e127]:
            - generic [ref=e128]: 200+
            - generic [ref=e129]: Registered Vehicles
      - generic [ref=e132]:
        - heading "Ready to join Drifee?" [level=2] [ref=e133]
        - paragraph [ref=e134]: Register as a driver or vehicle and start earning rewards.
        - generic [ref=e135]:
          - link "Register Driver" [ref=e136] [cursor=pointer]:
            - /url: /register/driver
          - link "Register Vehicle" [ref=e137] [cursor=pointer]:
            - /url: /register/vehicle
    - contentinfo [ref=e138]:
      - generic [ref=e139]:
        - generic [ref=e140]:
          - generic [ref=e141]:
            - generic [ref=e142]: Drifeeby Briga
            - paragraph [ref=e151]: Smart EV fleet telematics platform for eco-driving and rewards.
          - generic [ref=e152]:
            - heading "Product" [level=4] [ref=e153]
            - list [ref=e154]:
              - listitem [ref=e155]:
                - link "Features" [ref=e156] [cursor=pointer]:
                  - /url: "#features"
              - listitem [ref=e157]:
                - link "How It Works" [ref=e158] [cursor=pointer]:
                  - /url: "#how-it-works"
              - listitem [ref=e159]:
                - link "Register Driver" [ref=e160] [cursor=pointer]:
                  - /url: /register/driver
              - listitem [ref=e161]:
                - link "Register Vehicle" [ref=e162] [cursor=pointer]:
                  - /url: /register/vehicle
          - generic [ref=e163]:
            - heading "Company" [level=4] [ref=e164]
            - list [ref=e165]:
              - listitem [ref=e166]:
                - link "Contact" [ref=e167] [cursor=pointer]:
                  - /url: "#"
              - listitem [ref=e168]:
                - link "Privacy Policy" [ref=e169] [cursor=pointer]:
                  - /url: "#"
              - listitem [ref=e170]:
                - link "Terms & Conditions" [ref=e171] [cursor=pointer]:
                  - /url: "#"
        - generic [ref=e172]: © 2026 Drifee by Briga. PT Briga Energi Indonesia.
  - alert [ref=e173]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Service Worker', () => {
  4  |   test('should register service worker', async ({ page }) => {
  5  |     await page.goto('/', { timeout: 10000 });
  6  |     const swRegistered = await page.evaluate(async () => {
  7  |       if ('serviceWorker' in navigator) {
  8  |         const registration = await navigator.serviceWorker.getRegistration();
  9  |         return !!registration;
  10 |       }
  11 |       return false;
  12 |     });
> 13 |     expect(swRegistered).toBe(true);
     |                          ^ Error: expect(received).toBe(expected) // Object.is equality
  14 |   });
  15 | });
  16 | 
```