import { getSource } from '../../src/lib/sources';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMiramPage } from '../../src/lib/ingestion/adapters/miram';
import { selectSources } from '../../src/lib/sources';
import { categoryLabel } from '../../src/i18n/ui';

const baroDeViver = getSource('miram-baro-de-viver');

const cases = [
  [
    'casa-elizalde',
    'miram-casa-elizalde.html',
    'H2',
    '10051',
    'Actualitat i història',
    8748,
    '2026-09-29',
    'Actualidad e historia',
  ],
  [
    'albareda',
    'miram-albareda-music-first.html',
    '02',
    '2264',
    'Música',
    3122,
    '2026-10-05',
    'Música',
  ],
  [
    'el-sortidor',
    'miram-sortidor-family.html',
    'TI',
    '3412',
    'ACTIVITATS FAMILIARS',
    0,
    '2026-12-11',
    'Talleres familiares',
  ],
  [
    'vil-la-urania',
    'miram-vil-la-urania.html',
    'AC',
    '8583',
    'Art i creació',
    4465,
    '2027-01-13',
    'Arte y creatividad',
  ],
  [
    'urgell',
    'miram-urgell.html',
    'H',
    '6864',
    'HUMANITATS',
    8748,
    '2026-09-28',
    'Humanidades',
  ],
  [
    'fab-casa-del-rellotge',
    'miram-fab-casa-del-rellotge.html',
    '01',
    '675',
    '1_Tallers de creació multimèdia i maker',
    0,
    '2026-11-14',
    'Nuevas tecnologías',
  ],
  [
    'fab-casa-del-mig',
    'miram-fab-casa-del-mig.html',
    '01',
    '674',
    '1_Tallers de creació multimèdia i maker',
    4120,
    '2026-11-05',
    'Nuevas tecnologías',
  ],
  [
    'fort-pienc',
    'miram-fort-pienc-languages.html',
    'ID',
    '4343',
    'IDIOMES',
    8748,
    '2026-09-28',
    'Idiomas',
  ],
  [
    'barceloneta',
    'miram-barceloneta-circus.html',
    '01',
    '4427',
    'CIRC',
    7060,
    '2026-10-09',
    'Circ',
  ],
  [
    'can-castello',
    'miram-can-castello-dance.html',
    '04',
    '1930',
    'DANSA',
    6296,
    '2026-09-29',
    'Baile y danza',
  ],
] as const;

describe('additional centres: verified source fixtures', () => {
  it.each(cases)(
    'parses %s with real identity, dates, price, and category presentation',
    (
      id,
      file,
      code,
      externalId,
      category,
      priceCents,
      startDate,
      spanishLabel,
    ) => {
      const source = selectSources(`miram-${id}`)[0]!;
      const pageUrl = `${source.listingUrl}&f=${code}`;
      const html = readFileSync(
        new URL(`../fixtures/${file}`, import.meta.url),
        'utf8',
      );
      const { records } = parseMiramPage(html, pageUrl);
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        externalId,
        category,
        priceCents,
        startDate,
        availability: null,
        courseLanguage: null,
      });
      expect(records[0]?.officialUrl).toBe(`${pageUrl}#accordion${externalId}`);
      expect(categoryLabel(category, 'es')).toBe(spanishLabel);
    },
  );
  it('scopes online workshops, shows, and meetups out of the configured snapshots', () => {
    expect(
      selectSources('miram-casa-elizalde')[0]?.excludedCategoryCodes,
    ).toContain('CO');
    expect(
      selectSources('miram-el-sortidor')[0]?.excludedCategoryCodes,
    ).toContain('TC');
    expect(
      selectSources('miram-fab-casa-del-mig')[0]?.excludedCategoryCodes,
    ).toContain('02');
    const [rellotge, mig] = [
      selectSources('miram-fab-casa-del-rellotge')[0]!,
      selectSources('miram-fab-casa-del-mig')[0]!,
    ];
    expect(rellotge.institution.id).not.toBe(mig.institution.id);
    expect(new URL(rellotge.listingUrl).searchParams.get('t')).toBe('CR');
    expect(new URL(mig.listingUrl).searchParams.get('t')).toBe('CM');
  });

  it('reads the identifier of single-session cards from the registration form and keeps unknown dates null', () => {
    const html = readFileSync(
      new URL(
        '../fixtures/miram-baro-de-viver-single-session.html',
        import.meta.url,
      ),
      'utf8',
    );
    const pageUrl = `${baroDeViver.listingUrl}&f=01`;
    const { records } = parseMiramPage(html, pageUrl);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      externalId: '2302',
      priceCents: 0,
      startDate: null,
      endDate: null,
    });
    // A free childcare service attached to another workshop is not a course.
    expect(baroDeViver.excludedExternalIds).toEqual(['2300', '2301', '2302']);
  });
});
