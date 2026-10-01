import { defineConfig, devices } from '@playwright/test';

// Fallback secret HS256 KHUSUS e2e: dipakai bersama oleh
// e2e/fixtures/session.ts (menandatangani token) dan middleware
// (memverifikasi) saat SUPABASE_JWT_SECRET asli tidak tersedia.
// Nilai asli di environment selalu diutamakan.
process.env.SUPABASE_JWT_SECRET ||= 'e2e-hs256-signing-secret';

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html'], ['list']],
  use: {
    baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    headless: true,
    viewport: { width: 375, height: 667 },
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        channel: 'chrome',
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
