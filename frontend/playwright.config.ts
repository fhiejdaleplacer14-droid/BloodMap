import { defineConfig, devices } from '@playwright/test'

/**
 * Flows A–G (11 · Prototype Flows, 46:2) against a real API and database.
 *
 * Runs its own servers on spare ports so it never touches the dev setup:
 *   API      http://localhost:8100  (PHP built-in server, DB_DATABASE=bloodmap_e2e)
 *   Frontend http://localhost:5180  (Vite, VITE_API_URL → 8100)
 * The e2e database is reset and demo-seeded before every run (global-setup).
 * Flows share that database, so they run one at a time.
 */
const API = 'http://localhost:8100'
const WEB = 'http://localhost:5180'

export const E2E_ENV = {
  APP_ENV: 'local',
  APP_URL: API,
  FRONTEND_URL: WEB,
  DB_DATABASE: process.env.E2E_DB_DATABASE ?? 'bloodmap_e2e',
  SANCTUM_STATEFUL_DOMAINS: 'localhost:5180',
  SESSION_DOMAIN: 'localhost',
  MAIL_MAILER: 'array',
  QUEUE_CONNECTION: 'sync',
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: WEB,
    // Local runs use the installed Chrome; CI installs Playwright's Chromium.
    channel: process.env.CI ? undefined : 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testIgnore: /phone/ },
    { name: 'phone', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }, testMatch: /phone/ },
  ],
  webServer: [
    {
      // Laravel's router script resolves index.php from the working directory.
      command: 'php -S 127.0.0.1:8100 ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php',
      cwd: '../backend/public',
      url: `${API}/up`,
      env: E2E_ENV,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npx vite --port 5180 --strictPort',
      url: WEB,
      env: { VITE_API_URL: API },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
