/** Pending subscriptions seeded by setup.ts: one per Playwright project and test. */
const ids = {
  desktop: {
    flow: '00000000-0000-4000-8000-00000000e2e1',
    oneClick: '00000000-0000-4000-8000-00000000e2e2',
  },
  mobile: {
    flow: '00000000-0000-4000-8000-00000000e2e3',
    oneClick: '00000000-0000-4000-8000-00000000e2e4',
  },
};
export const E2E_ALERT_IDS = Object.values(ids).flatMap(Object.values);
export const e2eAlertId = (
  project: string,
  test: 'flow' | 'oneClick' = 'flow',
): string => ids[project === 'mobile' ? 'mobile' : 'desktop'][test];
// Matches the local-only ALERT_TOKEN_SECRET in wrangler.jsonc.
export const E2E_ALERT_SECRET = 'local-development-only-not-a-real-secret-000';
