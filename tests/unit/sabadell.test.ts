import { describe, expect, it } from 'vitest';
import {
  existsFixture,
  fakeSource,
  pathOf,
  readFixture,
} from '../helpers/source';
import {
  createSabadellAdapter,
  parseSabadellActivity,
  parseSabadellListing,
  sabadellDates,
  sabadellRecord,
} from '../../src/lib/ingestion/adapters/sabadell-centres-civics';
import { courseRecordSchema } from '../../src/lib/ingestion/validation/record';
import { centres } from '../../src/lib/centres/registry';
import { toSourceConfig } from '../../src/lib/centres/schema';
import { sources } from '../../src/lib/sources';

const fixture = (name: string) => readFixture(`sabadell-${name}.html`);
const source = (slug: string) =>
  toSourceConfig(centres.find((c) => c.id === `cc-sbd-${slug}`)!);
const ORIGIN = 'https://web.sabadell.cat';

describe('Sabadell course catalogue', () => {
  it('is paused until the Ajuntament allows reuse', () => {
    const sabadell = centres.filter((c) => c.cityId === 'sabadell');
    expect(sabadell).toHaveLength(13);
    expect(sabadell.every((c) => c.pausedReason)).toBe(true);
    expect(sources.some((s) => s.platform === 'sabadell-centres-civics')).toBe(
      false,
    );
  });

  it('lists the articles of a listing page', () => {
    const articles = parseSabadellListing(fixture('listing'));
    expect(articles).toHaveLength(10);
    expect(articles[0]).toEqual({
      id: '115889',
      path: '/index.php?option=com_content&view=article&id=115889&Itemid=3025',
    });
  });

  it('maps an activity with its venue, dates, schedule and organiser', () => {
    const activity = parseSabadellActivity(fixture('115889'), '115889');
    expect(activity).toEqual({
      id: '115889',
      title: 'ZUMBA JUVENIL I ADULTS',
      venueCode: 25735,
      startDate: '2026-09-14',
      endDate: '2027-07-23',
      scheduleText: 'dimecres de 20:15 a 21:15 h',
      organizer: 'AV Nous Barris Oest Can Llong',
    });
    const record = sabadellRecord(activity);
    expect(courseRecordSchema.safeParse(record).success).toBe(true);
    expect(record).toMatchObject({
      externalId: '115889',
      officialUrl: `${ORIGIN}/index.php?option=com_content&view=article&id=115889`,
      priceCents: null,
      currency: null,
    });
  });

  it("reads elided months (d'octubre) and only full date ranges", () => {
    expect(parseSabadellActivity(fixture('115845'), '115845')).toMatchObject({
      venueCode: 22880,
      startDate: '2026-10-01',
      endDate: '2027-07-08',
      organizer: 'Associació Llar de Gent Gran Can Borgonyó - Concòrdia',
    });
    for (const text of [
      '',
      'Dijous 1 d’octubre de 2026',
      'De dilluns 14 de setembre de 2026',
      'De dilluns 14 de setembri de 2026 a dijous 1 de juny de 2027',
    ])
      expect(sabadellDates(text)).toEqual({ startDate: null, endDate: null });
  });
});

describe('Sabadell adapter', () => {
  const run = (overrides: Record<string, string> = {}) => {
    const { options, requests } = fakeSource((url) => {
      const path = pathOf(url.href);
      if (path in overrides) return overrides[path];
      if (path === '/robots.txt') return null;
      // Page 2 repeats page 1, as Joomla does past the last page.
      if (url.pathname.endsWith('cursos-i-tallers')) return fixture('listing');
      const id = url.searchParams.get('id')!;
      // Activities without a saved article are at another centre.
      return existsFixture(`sabadell-${id}.html`)
        ? fixture(id)
        : fixture('115816')
            .replace('ZUMBA', `TEST ${id}`)
            .replace('26214', '1');
    });
    return { adapter: createSabadellAdapter(options), requests };
  };

  it('reads the catalogue and keeps the centre’s activities', async () => {
    const { adapter, requests } = run();
    const records = await adapter.fetchRecords(
      source('can-llong-castellarnau'),
    );
    expect(records.map((r) => r.externalId)).toEqual(['115889']);
    // Two listing pages (the second repeats) and one article per activity.
    expect(requests.filter((p) => p.includes('cursos-i-tallers'))).toHaveLength(
      2,
    );
    expect(requests.filter((p) => p.includes('view=article'))).toHaveLength(10);
  });

  it('honours a published robots.txt', async () => {
    await expect(
      run({
        '/robots.txt': 'User-agent: *\nDisallow: /activitats-subhome/\n',
      }).adapter.fetchRecords(source('concordia')),
    ).rejects.toThrow('robots.txt');
  });
});
