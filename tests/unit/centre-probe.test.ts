import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  draftEntry,
  parseMiramRoot,
  probeOrigin,
} from '../../src/lib/centres/probe';
import { centreSchema } from '../../src/lib/centres/schema';

const origin = 'https://fortpienc.inscripcionscc.com';
const html = readFileSync(
  new URL('../fixtures/miram-fort-pienc-root.html', import.meta.url),
  'utf8',
);

describe('centre probe', () => {
  const probe = parseMiramRoot(
    html,
    `${origin}/MiramModular/buscador/buscador.jsp`,
  );

  it('reads centre code, footer identity and activity types from the saved page', () => {
    expect(probe.title).toBe('Fort Pienc');
    expect(probe.centreCodes).toEqual([5]);
    expect(probe.footerName).toBe('CENTRE CÍVIC ATENEU FORT PIENC');
    expect(probe.footerAddress).toBe('Plaça Fort Pienc, 4-5, 08013 Barcelona');
    expect(probe.activityTypes.map((t) => [t.type, t.label])).toEqual([
      ['AC', 'Tallers Culturals'],
      ['BI', 'Itineraris'],
      ['CE', 'Espectacles i Conferències'],
    ]);
    expect(
      probe.activityTypes.find((t) => t.type === 'AC')?.categories,
    ).toContainEqual({ code: 'ID', label: 'IDIOMES' });
  });

  it('does not report footer phone numbers or email addresses', () => {
    expect(JSON.stringify(probe)).not.toMatch(/932327827|@/);
  });

  it('prefills only observed registration facts and cannot validate until reviewed', () => {
    const draft = draftEntry(origin, probe, '2026-11-08');
    expect(draft.registration).toMatchObject({
      platform: 'miram',
      origin,
      centreCode: 5,
      activityType: 'AC',
      robotsTxt: 'absent',
    });
    expect(centreSchema.safeParse(draft).success).toBe(false);
    // Completing only the obvious TODOs must still fail: no profile value validates unreviewed.
    const partial = {
      ...draft,
      id: 'cc-fort-pienc',
      slug: 'fort-pienc',
      name: 'Centre Cívic Ateneu Fort Pienc',
      officialUrl: 'https://www.fortpienc.org/',
      address: 'Plaça Fort Pienc, 4-5, 08013 Barcelona',
      city: 'Barcelona',
      cityId: 'barcelona',
    };
    expect(centreSchema.safeParse(partial).success).toBe(false);
    const withoutProfile: Record<string, unknown> = { ...partial };
    delete withoutProfile.profile;
    expect(centreSchema.safeParse(withoutProfile).success).toBe(true);
  });

  it('leaves the centre code unset when it is ambiguous', () => {
    const draft = draftEntry(
      origin,
      { ...probe, centreCodes: [5, 6] },
      '2026-11-08',
    );
    expect(draft.registration).toMatchObject({ centreCode: 0 });
  });

  it.each([
    'http://fortpienc.inscripcionscc.com',
    'https://example.com',
    'https://fortpienc.inscripcionscc.com:8443',
    'https://user:pw@fortpienc.inscripcionscc.com',
    'file:///etc/passwd',
    'not a url',
  ])('refuses to probe %s', (target) => {
    expect(() => probeOrigin(target)).toThrow();
  });

  it('normalises an approved URL to its origin', () => {
    expect(
      probeOrigin(`${origin}/MiramModular/buscador/buscador.jsp?g=1&c=5&t=AC`),
    ).toBe(origin);
  });
});
