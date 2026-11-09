import { readdirSync } from 'node:fs';
import { formatISO } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { centreFiles, centres } from '../../src/lib/centres/registry';
import {
  aulaAbiertaListingUrl,
  centreSchema,
  miramListingUrl,
  toSourceConfig,
  type Centre,
} from '../../src/lib/centres/schema';
import { sources } from '../../src/lib/sources';

const dataDirectory = new URL('../../data/centres/', import.meta.url);
const today = formatISO(new Date(), { representation: 'date' });

function withRegistration(change: Record<string, unknown>) {
  const base = structuredClone(centres[0]!) as Centre;
  return {
    ...base,
    registration: { ...base.registration, ...change },
  };
}

describe('centre registry', () => {
  it('is organised as data/centres/<country>/<city>.json and every file is registered', () => {
    const files = readdirSync(dataDirectory, { recursive: true })
      .map(String)
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.replace(/\.json$/, ''))
      .sort();
    expect(files).toEqual(Object.keys(centreFiles).sort());
    for (const [path, records] of Object.entries(centreFiles)) {
      const [country, city] = path.split('/');
      expect(country).toMatch(/^[a-z]{2}$/);
      for (const record of records as Centre[]) {
        // A record in the wrong file would be easy to miss in review.
        expect(record.country.toLowerCase()).toBe(country);
        expect(record.cityId).toBe(city);
      }
    }
  });

  it('derives one approved source per centre with stable identifiers', () => {
    const active = centres.filter((c) => !c.pausedReason);
    expect(sources).toHaveLength(active.length);
    for (const centre of active) {
      const source = sources.find((s) => s.institution.id === centre.id)!;
      expect(source.platform).toBe(centre.registration.platform);
      expect(source.id).toBe(`${centre.registration.platform}-${centre.slug}`);
      const url = new URL(source.listingUrl);
      expect(url.protocol).toBe('https:');
      if (centre.registration.platform === 'miram') {
        expect(source.listingUrl).toBe(miramListingUrl(centre.registration));
        expect(url.pathname).toBe('/MiramModular/buscador/buscador.jsp');
        expect([...url.searchParams.keys()]).toEqual(['g', 'c', 't']);
      }
      expect(source.institution.address).toBe(centre.address);
    }
  });

  it('keeps paused centres validated but out of ingestion and scheduling', () => {
    const paused = centres.filter((c) => c.pausedReason);
    expect(paused.length).toBeGreaterThan(0);
    for (const centre of paused)
      expect(sources.some((s) => s.institution.id === centre.id)).toBe(false);
  });

  it('builds Aula Abierta sources from the classroom code', () => {
    const alicante = centres.filter(
      (c) => c.registration.platform === 'alicante-aula-abierta',
    );
    expect(alicante.length).toBeGreaterThan(0);
    for (const centre of alicante) {
      const source = aulaAbiertaListingUrl(
        centre.registration as Extract<
          Centre['registration'],
          { platform: 'alicante-aula-abierta' }
        >,
      );
      expect(source).toMatch(
        /^https:\/\/w3\.alicante\.es\/cultura\/aula-abierta\/consulta-cursos\.php\?aula=\d+$/,
      );
    }
  });

  it('has unique centres, never-future verification dates and documented exclusions', () => {
    for (const key of ['id', 'slug'] as const)
      expect(new Set(centres.map((c) => c[key])).size).toBe(centres.length);
    expect(new Set(sources.map((s) => s.listingUrl)).size).toBe(sources.length);
    expect(new Set(centres.map((c) => toSourceConfig(c).listingUrl)).size).toBe(
      centres.length,
    );
    for (const centre of centres) {
      expect(centre.registration.verifiedAt <= today).toBe(true);
      expect((centre.profile.detailsVerifiedAt ?? today) <= today).toBe(true);
      for (const exclusion of 'exclusions' in centre.registration
        ? (centre.registration.exclusions ?? [])
        : [])
        expect(exclusion.reason.length).toBeGreaterThanOrEqual(10);
    }
  });

  it('keeps exclusions in the generated source configuration', () => {
    const patiLlimona = sources.find((s) => s.id === 'miram-pati-llimona')!;
    expect(patiLlimona.excludedExternalIds).toEqual(['5088']);
    const canBaste = sources.find((s) => s.id === 'miram-can-baste')!;
    expect(canBaste.excludedCategoryCodes).toEqual(['14']);
    const santAndreu = sources.find((s) => s.id === 'miram-sant-andreu')!;
    expect(santAndreu).not.toHaveProperty('excludedCategoryCodes');
    expect(santAndreu).not.toHaveProperty('mayBeEmpty');
    expect(
      sources.find((s) => s.id === 'miram-casa-elizalde')!.mayBeEmpty,
    ).toBe(true);
  });
});

describe('centre schema rejects unsafe or undocumented entries', () => {
  it('accepts the registry as written', () => {
    for (const centre of centres)
      expect(centreSchema.safeParse(centre).success).toBe(true);
    expect(toSourceConfig(centres[0]!).institution.id).toBe(centres[0]!.id);
  });

  it.each([
    ['plain HTTP', 'http://santandreu.inscripcionscc.com'],
    ['an unapproved host', 'https://example.com'],
    ['a path on the origin', 'https://santandreu.inscripcionscc.com/x'],
    ['a look-alike host', 'https://inscripcionscc.com.evil.example'],
    ['a port override', 'https://santandreu.inscripcionscc.com:8443'],
  ])('rejects registration origins with %s', (_, origin) => {
    expect(centreSchema.safeParse(withRegistration({ origin })).success).toBe(
      false,
    );
  });

  it.each([
    ['an exclusion without a reason', { exclusions: [{ categoryCode: '14' }] }],
    [
      'a very short reason',
      { exclusions: [{ externalId: '1', reason: 'no' }] },
    ],
    ['a robots.txt policy that was not reviewed', { robotsTxt: 'present' }],
    ['an unknown platform', { platform: 'unknown' }],
    ['an unknown key', { cookiesFrom: 'browser' }],
    ['a non-date verification', { verifiedAt: 'yesterday' }],
  ])('rejects %s', (_, change) => {
    expect(centreSchema.safeParse(withRegistration(change)).success).toBe(
      false,
    );
  });

  it('rejects placeholders left by the probe script', () => {
    const draft = { ...structuredClone(centres[0]!), name: 'TODO' };
    expect(centreSchema.safeParse(draft).success).toBe(false);
  });
});
