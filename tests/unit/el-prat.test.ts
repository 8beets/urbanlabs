import { describe, expect, it } from 'vitest';
import {
  existsFixture,
  fakeSource,
  pathOf,
  readFixture,
} from '../helpers/source';
import {
  createElPratAdapter,
  elPratDates,
  elPratPriceCents,
  elPratSchedule,
  parseElPratCourse,
  parseElPratListing,
} from '../../src/lib/ingestion/adapters/el-prat-cursos';
import { courseRecordSchema } from '../../src/lib/ingestion/validation/record';
import { courseTopic } from '../../src/lib/courses/categories';
import { sources } from '../../src/lib/sources';

const fixture = (name: string) => readFixture(`el-prat-${name}.html`);
const santJordi = sources.find(
  (s) => s.id === 'el-prat-cursos-sant-jordi-ribera-baixa',
)!;
const GUIDE = 'https://www.elprat.cat/la-ciutat/guia-cursos-i-tallers';
const listing = parseElPratListing(fixture('listing-0'));
const card = (slug: string) =>
  [
    ...listing.courses,
    ...parseElPratListing(fixture('listing-last')).courses,
  ].find((c) => c.slug === slug)!;

describe('El Prat course guide', () => {
  it('reads the course cards and the next page', () => {
    expect(listing.courses).toHaveLength(6);
    expect(card('fet-x-joves-punch-needle')).toEqual({
      slug: 'fet-x-joves-punch-needle',
      type: 'Manualitats',
      centrePage: '/cultura/centre-civic-sant-jordi-ribera-baixa',
      cancelled: false,
    });
    expect(card('cuina-jove-pasta-fresca').cancelled).toBe(true);
    expect(listing.next).toBe('/la-ciutat/guia-cursos-i-tallers?page=1');
    expect(parseElPratListing(fixture('listing-last')).next).toBeNull();
  });

  it('maps a one-day paid course', () => {
    const record = parseElPratCourse(
      fixture('fet-x-joves-punch-needle'),
      card('fet-x-joves-punch-needle'),
      santJordi,
    );
    expect(courseRecordSchema.safeParse(record).success).toBe(true);
    expect(record).toEqual({
      externalId: 'fet-x-joves-punch-needle',
      title: 'Fet x joves: Punch Needle',
      officialUrl: `${GUIDE}/fet-x-joves-punch-needle`,
      category: 'Manualitats',
      startDate: '2026-11-13',
      endDate: '2026-11-13',
      scheduleText: 'Divendres, de 18 a 20 h (1 sessió)',
      priceCents: 1000,
      currency: 'EUR',
      availability: null,
      isCancelled: false,
      isSoldOut: false,
      courseLanguage: null,
    });
  });

  it('maps a cancelled course with a date range and a bare price', () => {
    const record = parseElPratCourse(
      fixture('iniciacio-al-slackline'),
      card('iniciacio-al-slackline'),
      santJordi,
    );
    expect(record).toMatchObject({
      startDate: '2026-10-26',
      endDate: '2026-11-30',
      priceCents: 5000,
      isCancelled: true,
      category: 'Circ',
    });
  });

  it('reads only exact dates and prices', () => {
    expect(
      elPratDates('Del 14/11/2026 - 11:00 h al 21/11/2026 - 13:00 h'),
    ).toEqual({ startDate: '2026-11-14', endDate: '2026-11-21' });
    expect(elPratDates('16/11/2026 de 18:00 a 19:30 h')).toEqual({
      startDate: '2026-11-16',
      endDate: '2026-11-16',
    });
    // Anything else (several loose dates, no date) stays unknown.
    for (const when of ['', 'Dimarts 03/11/2026 i 10/11/2026', 'Octubre'])
      expect(elPratDates(when)).toEqual({ startDate: null, endDate: null });
    expect(
      elPratSchedule(
        'Del 06/10/2026 al 01/12/2026 Dimarts, de 18.30 a 19.30 h',
      ),
    ).toBe('Dimarts, de 18.30 a 19.30 h');
    expect(
      elPratSchedule('Del 14/11/2026 - 11:00 h al 21/11/2026 - 13:00 h'),
    ).toBe('11:00 - 13:00 h');
    expect(elPratSchedule('16/11/2026 de 18:00 a 19:30 h')).toBe(
      'de 18:00 a 19:30 h',
    );
    expect(elPratSchedule('12/12/2026')).toBeNull();
    expect(elPratPriceCents('37€ 9 sessions')).toBe(3700);
    expect(elPratPriceCents('24€')).toBe(2400);
    expect(elPratPriceCents('12,50 €')).toBe(1250);
    expect(elPratPriceCents('Inscripció gratuïta')).toBe(0);
    expect(elPratPriceCents('Gratuït 10 sessions.')).toBe(0);
    for (const text of ['', 'Consulteu preus', '10€/mes', 'Des de 5€'])
      expect(elPratPriceCents(text)).toBeNull();
  });

  it('rejects a course page for another centre', () => {
    expect(() =>
      parseElPratCourse(
        fixture('fet-x-joves-punch-needle'),
        card('fet-x-joves-punch-needle'),
        { ...santJordi, venue: '/cultura/centre-civic-jardins-de-la-pau' },
      ),
    ).toThrow('is not at');
  });

  it('maps the guide’s types to topics', () => {
    expect(courseTopic({ category: 'Cuina', title: '' })).toBe('cuina');
    expect(
      courseTopic({
        category: 'Informàtica, internet i noves tecnologies',
        title: '',
      }),
    ).toBe('tecnologia');
    expect(courseTopic({ category: 'Circ', title: '' })).toBe('teatre');
  });
});

describe('El Prat adapter', () => {
  const pages: Record<string, string> = {
    '/robots.txt':
      'User-agent: *\nCrawl-delay: 10\nDisallow: /admin/\nDisallow: /search/\n',
    '/la-ciutat/guia-cursos-i-tallers': fixture('listing-0'),
    '/la-ciutat/guia-cursos-i-tallers?page=1': fixture('listing-last'),
  };
  const run = (overrides: Record<string, string> = {}) => {
    const { options, requests } = fakeSource((url) => {
      const path = pathOf(url.href);
      const slug = url.pathname.match(/guia-cursos-i-tallers\/(.+)$/)?.[1];
      // Course pages are the saved ones; any other course page is a 404.
      const saved = slug && existsFixture(`el-prat-${slug}.html`);
      return overrides[path] ?? pages[path] ?? (saved ? fixture(slug) : null);
    });
    return { adapter: createElPratAdapter(options), requests };
  };

  it('reads every guide page and only the centre’s course pages', async () => {
    const { adapter, requests } = run();
    const records = await adapter.fetchRecords(santJordi);
    expect(records.map((r) => r.externalId).sort()).toEqual([
      'catanies-carquinyolis-i-garapinyades',
      'cuina-jove-pasta-fresca',
      'fet-x-joves-punch-needle',
      'iniciacio-al-slackline',
    ]);
    expect(records.every((r) => courseRecordSchema.safeParse(r).success)).toBe(
      true,
    );
    // Other centres' course pages are never requested.
    expect(requests.map(pathOf)).not.toContain(
      '/la-ciutat/guia-cursos-i-tallers/sexy-style-batxata',
    );
  });

  it('applies the crawl delay unless told otherwise', async () => {
    const delays: number[] = [];
    const adapter = createElPratAdapter({
      sleep: async (ms) => {
        delays.push(ms);
        throw new Error('stop');
      },
    });
    await expect(adapter.fetchRecords(santJordi)).rejects.toThrow('stop');
    expect(delays).toEqual([10_000]);
  });

  it('honours robots.txt', async () => {
    await expect(
      run({
        '/robots.txt': 'User-agent: *\nDisallow: /la-ciutat/\n',
      }).adapter.fetchRecords(santJordi),
    ).rejects.toThrow('robots.txt');
  });
});
