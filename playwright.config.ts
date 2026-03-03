import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: process.env.CI ? 60_000 : 30_000,
  reporter: 'html',
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:3002/omenaa',
    trace: 'on-first-retry',
    ...(process.env.CI
      ? { launchOptions: { args: ['--no-sandbox', '--disable-setuid-sandbox'] } }
      : {}),
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/admin.json',
      },
      testMatch: /.*\/admin\/.*\.spec\.ts/,
      dependencies: ['setup'],
    },
    ...(process.env.CI
      ? []
      : [
          {
            name: 'mobile-chrome',
            use: {
              ...devices['Pixel 5'],
              viewport: { width: 375, height: 667 },
              storageState: 'tests/e2e/.auth/user.json',
            },
            dependencies: ['setup'],
          },
        ]),
  ],
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3002/omenaa',
        reuseExistingServer: true,
        timeout: 120000,
      },
});
