import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://127.0.0.1:4322', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // Seeds an isolated local D1, snapshots it, builds the static site from that
    // snapshot and serves the build like Cloudflare does (assets first, then the
    // Worker for alert pages), with the same local D1 state.
    command:
      'node --import tsx tests/e2e/setup.ts && npm run build && npx wrangler dev --config dist/server/wrangler.json --persist-to .wrangler/e2e-state --port 4322 --ip 127.0.0.1',
    env: { URBANLABS_SNAPSHOT: '.cache/e2e-snapshot.json' },
    url: 'http://127.0.0.1:4322',
    reuseExistingServer: false,
    stdout: 'pipe',
    // Fixture seeding, the static build and workerd startup share the budget.
    timeout: 240000,
  },
});
