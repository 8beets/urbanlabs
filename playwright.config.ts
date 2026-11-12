import { defineConfig, devices } from '@playwright/test';

const ci = Boolean(process.env.CI);

// Run `npm run test:e2e`, which seeds the fixture database and builds the site once
// (`npm run e2e:build`) before testing. `npx playwright test` reuses the last build.
export default defineConfig({
  testDir: './tests/e2e',
  // Tests are independent (alert tests use their own subscription ids), so tests
  // within a file run in parallel too, not only whole files.
  fullyParallel: true,
  forbidOnly: ci,
  reporter: ci ? [['github'], ['dot'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://127.0.0.1:4322', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // Filter and data logic is the same at every width; the phone project only runs
    // tests tagged @mobile (layout, the collapsible filter panel, maps, homepage).
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: {
    // Serves the build like Cloudflare does (assets first, then the Worker for alert
    // pages) with the seeded local D1 state.
    command:
      'npx wrangler dev --config dist/server/wrangler.json --persist-to .wrangler/e2e-state --port 4322 --ip 127.0.0.1',
    url: 'http://127.0.0.1:4322',
    reuseExistingServer: false,
    stdout: 'pipe',
    timeout: 60000,
  },
});
