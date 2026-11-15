import { describe, expect, it } from 'vitest';
import { fakeSource, pathOf, readFixture } from '../helpers/source';
import {
  centreRecords,
  cityRecords,
  createOpenDataAdapter,
  openDataRecord,
  openDataRows,
} from '../../src/lib/ingestion/adapters/open-courses-data';
import {
  draftOpenDataCentre,
  openDataCentres,
} from '../../src/lib/centres/open-data';
import {
  centreSchema,
  openDataFileUrl,
  openDataRawPath,
  toSourceConfig,
} from '../../src/lib/centres/schema';
import { courseRecordSchema } from '../../src/lib/ingestion/validation/record';

const courses = readFixture('open-courses-data/courses.csv');
const centresCsv = readFixture('open-courses-data/centres.csv');
const FOLDER = 'es/catalunya/barcelona';
const draft = draftOpenDataCentre(
  openDataCentres(centresCsv)[0]!,
  FOLDER,
  '2026-11-15',
);
const source = toSourceConfig(draft);
const COURSES_PATH = openDataRawPath(FOLDER, 'courses.csv');

describe('open-data courses.csv', () => {
  it('reads every known column, ignores extra ones and skips blank lines', () => {
    const rows = openDataRows(courses);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      row: 2,
      centre_id: 'test-centre',
      title: 'TEST Cerámica, nivel 1',
      price_eur: '45.50',
    });
    expect(rows[0]).not.toHaveProperty('notes');
  });

  it('maps rows to records without inventing values', () => {
    const records = cityRecords(courses).map((entry) => entry.record);
    for (const record of records)
      expect(courseRecordSchema.safeParse(record).success).toBe(true);
    expect(records[0]).toEqual({
      externalId: '2026-ceramica-1',
      title: 'TEST Cerámica, nivel 1',
      officialUrl: 'https://example.org/ceramica',
      category: 'Artes plásticas',
      startDate: '2026-10-05',
      endDate: '2026-12-14',
      scheduleText: 'Lunes, 18:00–20:00',
      priceCents: 4550,
      currency: 'EUR',
      availability: null,
      isCancelled: false,
      isSoldOut: false,
      courseLanguage: null,
    });
    expect(records[1]).toMatchObject({
      category: null,
      endDate: null,
      scheduleText: null,
      priceCents: 0,
      isSoldOut: true,
    });
    expect(records[2]).toMatchObject({
      startDate: null,
      priceCents: null,
      currency: null,
      isCancelled: true,
    });
  });

  it('rejects a bad row with its row number and column', () => {
    const row = { ...openDataRows(courses)[0]! };
    expect(() => openDataRecord({ ...row, start_date: '05/10/2026' })).toThrow(
      'row 2, start_date',
    );
    expect(() => openDataRecord({ ...row, price_eur: 'gratis' })).toThrow(
      'row 2, price_eur',
    );
    expect(() =>
      openDataRecord({ ...row, official_url: 'http://example.org' }),
    ).toThrow('must be https');
    expect(() => openDataRecord({ ...row, status: 'full' })).toThrow(
      'row 2, status',
    );
    expect(() =>
      openDataRecord({
        ...row,
        start_date: '2026-12-01',
        end_date: '2026-11-01',
      }),
    ).toThrow('start_date is after end_date');
    expect(() => openDataRows('centre_id,title\nx,y\n')).toThrow(
      'lacks column course_id',
    );
    expect(() =>
      openDataRows(
        'centre_id,course_id,title,official_url\na,b,c,https://e.org,extra\n',
      ),
    ).toThrow('row 2 has the wrong number of fields');
  });

  it("fails a whole city when any centre's row is malformed", () => {
    const broken = courses.replace('2026-ingles', 'bad id with spaces');
    expect(() => cityRecords(broken)).toThrow('course_id');
  });

  it("keeps only the source centre's courses", () => {
    expect(
      centreRecords(cityRecords(courses), source).map((r) => r.externalId),
    ).toEqual(['2026-ceramica-1', '2026-yoga']);
  });
});

describe('open-data centres.csv', () => {
  it('drafts a valid registry record pointing back to the data file', () => {
    expect(centreSchema.safeParse(draft).success).toBe(true);
    expect(draft).toMatchObject({
      id: 'od-barcelona-test-centre',
      slug: 'test-centre-civic-exemple',
      cityId: 'barcelona',
      country: 'ES',
      timezone: 'Europe/Madrid',
      profile: {
        phone: '931 234 567',
        email: 'test@example.org',
        location: {
          latitude: 41.3851,
          longitude: 2.1734,
          sourceUrl: openDataFileUrl(FOLDER, 'centres.csv'),
        },
      },
      registration: {
        platform: 'open-courses-data',
        folder: FOLDER,
        centreId: 'test-centre',
        mayBeEmpty: true,
      },
    });
    const other = draftOpenDataCentre(
      openDataCentres(centresCsv)[1]!,
      FOLDER,
      '2026-11-15',
    );
    expect(other.profile).not.toHaveProperty('phone');
  });

  it('rejects unknown cities, bad coordinates and repeated ids', () => {
    const centre = openDataCentres(centresCsv)[0]!;
    expect(() =>
      draftOpenDataCentre(centre, 'es/nowhere/atlantis', '2026-11-15'),
    ).toThrow('not a city in data/geography.json');
    expect(() =>
      openDataCentres(centresCsv.replace('41.3851', '41.38')),
    ).toThrow('row 2, latitude');
    expect(() =>
      openDataCentres(centresCsv.replace('other-centre', 'test-centre')),
    ).toThrow('repeats a centre id');
  });

  it('builds a source that reads the city file and links to it on GitHub', () => {
    expect(source).toMatchObject({
      platform: 'open-courses-data',
      venue: 'test-centre',
      dataFolder: FOLDER,
      listingUrl: `${openDataFileUrl(FOLDER, 'courses.csv')}#test-centre`,
    });
  });
});

describe('open-data adapter', () => {
  const run = (
    files: Record<string, string | null>,
    mayBeEmpty = source.mayBeEmpty,
  ) => {
    const { options, requests } = fakeSource(
      (url) => files[pathOf(url.href)] ?? null,
    );
    return {
      fetch: () =>
        createOpenDataAdapter(options).fetchRecords({ ...source, mayBeEmpty }),
      requests,
    };
  };

  it("reads the city's courses.csv after checking robots.txt", async () => {
    const { fetch, requests } = run({ [COURSES_PATH]: courses });
    expect((await fetch()).map((r) => r.externalId)).toEqual([
      '2026-ceramica-1',
      '2026-yoga',
    ]);
    expect(requests.map(pathOf)).toEqual(['/robots.txt', COURSES_PATH]);
  });

  it('treats a folder without courses.csv as empty only when allowed', async () => {
    expect(await run({}).fetch()).toEqual([]);
    await expect(run({}, false).fetch()).rejects.toThrow(
      `No courses.csv in ${FOLDER}`,
    );
  });

  it('stops when a robots.txt disallows the file', async () => {
    const { fetch, requests } = run({
      '/robots.txt': 'User-agent: *\nDisallow: /8beets/\n',
      [COURSES_PATH]: courses,
    });
    await expect(fetch()).rejects.toThrow('robots.txt');
    expect(requests.map(pathOf)).toEqual(['/robots.txt']);
  });
});
