import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', testMatch: '*.spec.ts', fullyParallel: false, workers: 1,
  reporter: 'list', use: { baseURL: 'http://127.0.0.1:5174', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width:1440,height:1000 } } },
    { name: 'mobile-chrome', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', channel: 'chrome' } },
    { name: 'compact-mobile-chrome', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', channel: 'chrome', viewport: { width: 320, height: 740 }, deviceScaleFactor: 1 } },
    { name: 'tablet-chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 768, height: 1024 } } },
  ],
  // Disposable test-only provider configuration. App source has no mock/demo auth mode.
  webServer: {
    command: 'npm run dev -w @wardrobe/web -- --port 5174', url: 'http://127.0.0.1:5174',
    reuseExistingServer: false, timeout: 120000,
    env: { VITE_SUPABASE_URL:'https://wardrobe-browser-test.invalid', VITE_SUPABASE_PUBLISHABLE_KEY:'browser-test-public-key' },
  },
});
