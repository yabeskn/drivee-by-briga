# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: rewards\redeem-reward.spec.ts >> Redeem Reward >> should show rewards catalog
- Location: e2e\rewards\redeem-reward.spec.ts:4:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Available Rewards')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('text=Available Rewards') with timeout 5000ms
  - waiting for locator('text=Available Rewards')

```

```yaml
- dialog "Unhandled Runtime Error":
  - navigation:
    - button "previous" [disabled]:
      - img "previous"
    - button "next" [disabled]:
      - img "next"
    - text: 1 of 1 error Next.js (14.2.35) is outdated
    - link "(learn more)":
      - /url: https://nextjs.org/docs/messages/version-staleness
  - button "Close"
  - heading "Unhandled Runtime Error" [level=1]
  - paragraph: "TypeError: rewards.map is not a function"
  - heading "Source" [level=2]
  - link "src\\app\\rewards\\page.tsx (156:22) @ map":
    - text: src\app\rewards\page.tsx (156:22) @ map
    - img
  - text: "154 | ) : ( 155 | <div className=\"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4\"> > 156 | {rewards.map((reward) => ( | ^ 157 | <div key={reward.id} className=\"bg-zinc-950 border border-zinc-800 rounded-xl p-4\"> 158 | <div className=\"flex items-start justify-between mb-3\"> 159 | <span className={`px-2 py-0.5 rounded text-xs font-medium ${getCategoryColor(reward.category)}`}>"
  - heading "Call Stack" [level=2]
  - button "Show collapsed frames"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Redeem Reward', () => {
  4  |   test('should show rewards catalog', async ({ page }) => {
  5  |     await page.goto('/rewards', { timeout: 10000 });
> 6  |     await expect(page.locator('text=Available Rewards')).toBeVisible({ timeout: 5000 });
     |                                                          ^ Error: expect(locator).toBeVisible() failed
  7  |   });
  8  | 
  9  |   test('should show redeem button for each reward', async ({ page }) => {
  10 |     await page.goto('/rewards', { timeout: 10000 });
  11 |     await expect(page.locator('text=Redeem')).toBeVisible({ timeout: 5000 });
  12 |   });
  13 | });
  14 | 
```