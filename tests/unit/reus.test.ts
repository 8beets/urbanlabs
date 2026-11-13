import { describe, expect, it } from 'vitest';
import {
  existsFixture,
  fakeSource,
  pathOf,
  readFixture,
} from '../helpers/source';
import {
  createReusAdapter,
  parseReusActivity,
  parseReusListing,
  reusPriceCents,
} from '../../src/lib/ingestion/adapters/reus-inscripcions';
import { courseRecordSchema } from '../../src/lib/ingestion/validation/record';
import { centres } from '../../src/lib/centres/registry';
import { toSourceConfig } from '../../src/lib/centres/schema';
import { sources } from '../../src/lib/sources';

const fixture = (name: string) => readFixture(`reus-${name}.html`);
const source = (slug: string) =>
  toSourceConfig(centres.find((c) => c.id === `cc-reus-${slug}`)!);

describe('Reus civic-centre activities', () => {
  it('is paused until the Ajuntament allows reuse', () => {
    const reus = centres.filter((c) => c.cityId === 'reus');
    expect(reus).toHaveLength(7);
    expect(reus.every((c) => c.pausedReason)).toBe(true);
    expect(sources.some((s) => s.platform === 'reus-inscripcions')).toBe(false);
  });

  it('reads the cards, their centre and the next page', () => {
    const first = parseReusListing(fixture('listing-1'));
    expect(first.cards).toHaveLength(21);
    expect(first.hasNext).toBe(true);
    expect(first.cards).toContainEqual({
      slug: 'cuinapersoltersccmigjorn2',
      venue: 'Centre Cívic Migjorn',
    });
    // ", Reus" is sometimes appended to the centre.
    expect(first.cards.every((c) => !c.venue.endsWith('Reus'))).toBe(true);
    expect(parseReusListing(fixture('listing-last')).hasNext).toBe(false);
  });

  it('maps a paid multi-week course that is sold out', () => {
    const record = parseReusActivity(
      fixture('cuinapersoltersccmigjorn2'),
      'cuinapersoltersccmigjorn2',
    );
    expect(courseRecordSchema.safeParse(record).success).toBe(true);
    expect(record).toEqual({
      venue: 'Centre Cívic Migjorn',
      externalId: 'cuinapersoltersccmigjorn2',
      title: 'CUINA PER SOLTERS',
      officialUrl: 'https://inscripcions.reus.cat/cuinapersoltersccmigjorn2',
      category: null,
      startDate: '2026-11-24',
      endDate: '2027-02-02',
      scheduleText: '19:45h - 21:15h',
      priceCents: 5565,
      currency: 'EUR',
      availability: null,
      isCancelled: false,
      isSoldOut: true,
      courseLanguage: null,
    });
  });

  it('maps a free one-day activity and keeps the stated centre', () => {
    expect(
      parseReusActivity(fixture('cafetertulia'), 'cafetertulia'),
    ).toMatchObject({
      venue: 'Centre Cívic Gregal',
      startDate: '2026-11-19',
      endDate: '2026-11-19',
      priceCents: 0,
      isSoldOut: false,
    });
    // The title says CC del Carme but the activity is at Migjorn: the place wins.
    expect(
      parseReusActivity(
        fixture('tastdecervesesccdelcarme'),
        'tastdecervesesccdelcarme',
      ),
    ).toMatchObject({
      venue: 'Centre Cívic Migjorn',
      title: 'TAST DE CERVESES',
    });
  });

  it('reads only a single exact price', () => {
    expect(reusPriceCents(['27.2€'])).toBe(2720);
    expect(reusPriceCents(['Gratuïta'])).toBe(0);
    expect(reusPriceCents(['Gratuït'])).toBe(0);
    for (const lines of [[], ['10€', '5€'], ['Consultar'], ['Des de 5€']])
      expect(reusPriceCents(lines)).toBeNull();
  });
});

describe('Reus adapter', () => {
  const run = (robots: string | null = null) => {
    const { options, requests } = fakeSource((url) => {
      const path = pathOf(url.href);
      if (path === '/robots.txt') return robots;
      const page = url.searchParams.get('page');
      if (page) return fixture(page === '1' ? 'listing-1' : 'listing-last');
      const slug = url.pathname.slice(1);
      // Unsaved activity pages of the centre reuse a saved Migjorn page.
      return existsFixture(`reus-${slug}.html`)
        ? fixture(slug)
        : fixture('cuinapersoltersccmigjorn2');
    });
    return { adapter: createReusAdapter(options), requests };
  };

  it("reads every listing page and only the centre's activity pages", async () => {
    const { adapter, requests } = run();
    const records = await adapter.fetchRecords(source('migjorn'));
    expect(records.length).toBeGreaterThan(0);
    expect(records.map((r) => r.externalId)).toContain(
      'cuinapersoltersccmigjorn2',
    );
    expect(records.every((r) => courseRecordSchema.safeParse(r).success)).toBe(
      true,
    );
    const paths = requests.map(pathOf);
    expect(paths.filter((p) => p.startsWith('/?page='))).toHaveLength(2);
    expect(paths).not.toContain(
      '/cafetertuliataularodonaauxinfermeriaicosidoresantichospital',
    );
  });

  it('rejects an activity page for another centre', async () => {
    await expect(run().adapter.fetchRecords(source('mestral'))).rejects.toThrow(
      'is at Centre Cívic Migjorn',
    );
  });

  it('honours robots.txt', async () => {
    await expect(
      run('User-agent: *\nDisallow: /?page=\n').adapter.fetchRecords(
        source('migjorn'),
      ),
    ).rejects.toThrow('robots.txt');
  });
});
