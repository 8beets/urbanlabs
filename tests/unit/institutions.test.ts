import { describe, expect, it } from 'vitest';
import {
  centreProfile,
  centreProfileSchema,
  verifiedCentreProfiles,
} from '../../src/lib/institutions/profiles';
import { centres } from '../../src/lib/centres/registry';
import {
  openStreetMapLocation,
  openStreetMapSearch,
} from '../../src/lib/institutions/maps';

describe('verified centre locations', () => {
  it('validates every registry profile with unique stable slugs and municipal provenance', () => {
    const profiles = Object.values(verifiedCentreProfiles).map((p) =>
      centreProfileSchema.parse(p),
    );
    expect(profiles).toHaveLength(centres.length);
    expect(new Set(profiles.map((p) => p.slug)).size).toBe(centres.length);
    for (const centre of centres) {
      const location = centre.profile.location;
      // A location is optional (unverified centres show the honest fallback); when
      // present it needs an https source. Barcelona centres use the municipal guide.
      if (location) expect(location.sourceUrl).toMatch(/^https:\/\//);
      if (centre.cityId === 'barcelona')
        expect(location?.sourceUrl).toMatch(
          /^https:\/\/guia.barcelona.cat\/ca\/detall\//,
        );
    }
    expect(centreProfile('cc-unknown')).toEqual({ slug: 'unknown' });
    expect(centreProfile('fab-casa-del-mig').notice).toBe('temporary_closure');
  });
  it('links to the exact verified marker on OpenStreetMap', () => {
    const map = openStreetMapLocation(41.43088018380354, 2.1894124386376466)!;
    const url = new URL(map.mapUrl);
    expect(url.origin).toBe('https://www.openstreetmap.org');
    expect(url.searchParams.get('mlat')).toBe('41.43088018380354');
    expect(url.searchParams.get('mlon')).toBe('2.1894124386376466');
    expect(url.hash).toBe('#map=17/41.43088018380354/2.1894124386376466');
  });
  it('keeps missing and invalid coordinates unknown', () => {
    for (const [lat, lon] of [
      [null, null],
      [41, null],
      [null, 2],
      [91, 2],
      [41, 181],
      [NaN, 2],
      [41, Infinity],
    ] as const)
      expect(openStreetMapLocation(lat, lon)).toBeNull();
    expect(
      centreProfileSchema.safeParse({
        slug: 'test',
        location: { latitude: 41, longitude: 2 },
      }).success,
    ).toBe(false);
    expect(
      centreProfileSchema.safeParse({
        slug: 'test',
        location: {
          latitude: 91,
          longitude: 2,
          sourceUrl: 'https://example.org',
          verifiedAt: '2026-11-06',
        },
      }).success,
    ).toBe(false);
    expect(
      new URL(
        openStreetMapSearch('Carrer & plaça 2', 'Barcelona'),
      ).searchParams.get('query'),
    ).toBe('Carrer & plaça 2, Barcelona');
  });
});
