import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  belongsTo,
  currentOffer,
  parseGironaActivity,
  parseGironaListing,
  publicPriceCents,
} from '../../src/lib/ingestion/adapters/girona-centres-civics';
import { adapterFor } from '../../src/lib/ingestion/adapters';
import { courseRecordSchema } from '../../src/lib/ingestion/validation/record';
import { sources } from '../../src/lib/sources';

const fixture = (name: string) =>
  readFileSync(
    new URL(`../fixtures/girona-centres-civics-${name}.html`, import.meta.url),
    'utf8',
  );
const girona = sources.filter((s) => s.platform === 'girona-centres-civics');
const source = (slug: string) =>
  girona.find((s) => s.id === `girona-centres-civics-${slug}`)!;
const listing = parseGironaListing(fixture('listing'));
const activity = (id: string) => listing.find((a) => a.id === id)!;

describe('Girona civic-centre parsing', () => {
  it('finds the network offer by its title', () => {
    expect(currentOffer(fixture('offers'))).toBe('181');
    expect(() => currentOffer('<ul></ul>')).toThrow('not found');
  });

  it('reads every listed activity', () => {
    expect(listing).toHaveLength(8);
    expect(activity('15868')).toEqual({
      id: '15868',
      code: 'BV26213B',
      title: 'EXERCICI DE FORÇA (DIMECRES)',
      group: 'Activitats físiques - anuals',
      venue: 'Espai Cívic Mercadal',
      freePlaces: 0,
    });
  });

  it('gives each activity to exactly one centre', () => {
    const owners = (id: string) =>
      girona
        .filter((s) => belongsTo(activity(id), s))
        .map((s) => s.id.replace('girona-centres-civics-', ''));
    expect(owners('14998')).toEqual(['barri-vell-mercadal']);
    // Satellite venues go to the centre whose code prefix they carry.
    expect(owners('15379')).toEqual(['barri-vell-mercadal']);
    expect(owners('15733')).toEqual(['pla-de-palau']);
    // Pedret's courses are coded PM like Pont Major's, but held at Pedret.
    expect(owners('14920')).toEqual(['pedret']);
    expect(owners('14892')).toEqual(['pont-major']);
  });

  it('maps a course with its period, schedule, public price and full places', () => {
    const record = parseGironaActivity(
      fixture('14998'),
      activity('14998'),
      source('barri-vell-mercadal'),
    );
    expect(courseRecordSchema.safeParse(record).success).toBe(true);
    expect(record).toEqual({
      externalId: '14998',
      title: 'IOGA KUNDALINI (DIMARTS)',
      officialUrl: 'https://seu.girona.cat/si/activitats/consulta3/14998',
      category: 'Activitats físiques - anuals',
      startDate: '2026-10-06',
      endDate: '2027-06-08',
      scheduleText: 'Dimarts de 17.30 a 19 h',
      priceCents: 27000,
      currency: 'EUR',
      availability: null,
      isCancelled: false,
      isSoldOut: true,
      courseLanguage: null,
    });
  });

  it('names the venue of courses held away from the centre', () => {
    expect(
      parseGironaActivity(
        fixture('15733'),
        activity('15733'),
        source('pla-de-palau'),
      ).scheduleText,
    ).toBe('Dilluns 19 - 20 h · Local Social AV Eixample');
  });

  it('keeps only an explicit public price', () => {
    expect(publicPriceCents('Preu públic: 46,8 €')).toBe(4680);
    expect(
      publicPriceCents('PREU PÚBLIC: 180 €\nPREU SOCI/ES ENTITAT: 160 €'),
    ).toBe(18000);
    expect(publicPriceCents('PREU PÚBLIC: 15 €\nPREU SOCI/SÒCIA: 0 €')).toBe(
      1500,
    );
    // Per-term and monthly prices do not give the price of the course.
    for (const tariff of [
      'PREU PÚBLIC TRIMESTRE: 80 €',
      'PREU TRIMESTRAL: 45 €',
      'Preu públic (mensual): 15 €',
      '',
    ])
      expect(publicPriceCents(tariff)).toBeNull();
  });

  it('leaves both dates unknown when the published period ends before it starts', () => {
    const record = parseGironaActivity(
      fixture('14998').replace('08/06/2027', '08/06/2026'),
      activity('14998'),
      source('barri-vell-mercadal'),
    );
    expect([record.startDate, record.endDate]).toEqual([null, null]);
    expect(courseRecordSchema.safeParse(record).success).toBe(true);
    expect(
      courseRecordSchema.safeParse({
        ...record,
        startDate: '2026-10-06',
        endDate: '2026-06-08',
      }).success,
    ).toBe(false);
  });

  it('rejects a detail page for another activity or venue', () => {
    expect(() =>
      parseGironaActivity(
        fixture('14892'),
        activity('14998'),
        source('barri-vell-mercadal'),
      ),
    ).toThrow('structure changed');
    expect(() =>
      parseGironaActivity(
        fixture('14998'),
        { ...activity('14998'), venue: 'C. C. Onyar' },
        source('onyar'),
      ),
    ).toThrow('venue mismatch');
  });
});

describe('Girona adapter', () => {
  it('keeps the listing session and fetches only its own courses', async () => {
    const requested: string[] = [];
    const fetch = async (url: string | URL | Request, init?: RequestInit) => {
      const path = new URL(String(url)).pathname;
      requested.push(path);
      const cookie = new Headers(init?.headers).get('cookie');
      if (path === '/robots.txt') return new Response('', { status: 404 });
      if (path === '/si/activitats/consulta')
        return new Response(fixture('offers'), {
          headers: { 'set-cookie': 'PHPSESSID=abc; path=/' },
        });
      if (path === '/si/activitats/consulta2/181')
        // Without the session the listing redirects to the offer index.
        return cookie === 'PHPSESSID=abc'
          ? new Response(fixture('listing'))
          : new Response(null, { status: 302 });
      const id = path.match(/consulta3\/(\d+)$/)?.[1];
      return new Response(fixture(id!));
    };
    const records = await adapterFor(source('pla-de-palau'), {
      fetch: fetch as typeof globalThis.fetch,
      sleep: async () => {},
    }).fetchRecords(source('pla-de-palau'));
    expect(records.map((r) => r.externalId)).toEqual(['15733']);
    expect(requested).toEqual([
      '/robots.txt',
      '/si/activitats/consulta',
      '/si/activitats/consulta2/181',
      '/si/activitats/consulta3/15733',
    ]);
  });
});
