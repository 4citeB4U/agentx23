import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir:     './tests/e2e',
  fullyParallel: true,
  forbidOnly:  !!process.env.CI,
  retries:     process.env.CI ? 2 : 0,
  workers:     process.env.CI ? 1 : undefined,
  reporter:    [['html', { outputFolder: 'tests/e2e/reports' }], ['list']],

  use: {
    baseURL:   process.env.AGENT_LEE_URL || 'http://localhost:3000',
    trace:     'on-first-retry',
    screenshot:'only-on-failure',
    video:     'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use:  { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use:  { ...devices['Desktop Firefox'] },
    },
  ],

  webServer: {
    command: 'node backend/src/index.js',
    url:     'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
