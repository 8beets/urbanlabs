import { describe, expect, it } from 'vitest';
import {
  checkFreshness,
  renderFreshnessReport,
} from '../../src/lib/centres/freshness';
import { centres } from '../../src/lib/centres/registry';

const options = {
  now: new Date('2027-06-01T12:00:00Z'),
  maxProfileAgeDays: 180,
  maxSourceAgeDays: 7,
};
const base = centres.find((c) => c.profile.location)!;
// Fixed dates keep the test independent of future re-verifications of the registry.
const centre = {
  ...base,
  profile: {
    ...base.profile,
    detailsVerifiedAt: '2026-11-06',
    location: { ...base.profile.location!, verifiedAt: '2026-11-06' },
  },
  registration: { ...base.registration, verifiedAt: '2026-11-06' },
};

describe('freshness check', () => {
  it('flags reviewed data older than the limit and nothing newer', () => {
    // Registry data was verified in November 2026: ~207 days before the check date.
    const stale = checkFreshness([centre], [], options);
    expect(stale.profiles.map((p) => p.field).sort()).toEqual([
      'details',
      'location',
      'registration',
    ]);
    const fresh = checkFreshness([centre], [], {
      ...options,
      now: new Date('2026-12-01T00:00:00Z'),
    });
    expect(fresh.profiles).toEqual([]);
  });
  it('flags never-imported and long-failing sources only', () => {
    const report = checkFreshness(
      [],
      [
        { id: 'a', lastSuccessAt: null },
        { id: 'b', lastSuccessAt: '2027-05-20T04:00:00Z' },
        { id: 'c', lastSuccessAt: '2027-05-31T04:00:00Z' },
      ],
      options,
    );
    expect(report.sources.map((s) => s.id)).toEqual(['a', 'b']);
    expect(report.sources[0]!.ageDays).toBeNull();
  });
  it('renders nothing when fresh and a readable report when not', () => {
    expect(
      renderFreshnessReport(
        { profiles: [], sources: [], categories: [] },
        options,
      ),
    ).toBe(null);
    const text = renderFreshnessReport(
      {
        profiles: [],
        sources: [{ id: 'a', lastSuccessAt: null, ageDays: null }],
        categories: ['NOVA CATEGORIA'],
      },
      options,
    )!;
    expect(text).toContain('`a`: never imported');
    expect(text).toContain('- `NOVA CATEGORIA`');
  });
});
