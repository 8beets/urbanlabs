import { getSource } from '../../src/lib/sources';
import { parseFilters } from '../../src/lib/courses/discovery';
import { clearGeographyCache } from '../../src/lib/locations/geography';
import { loadSourceStatuses } from '../../src/lib/db/ingestion-status';
import { liveCutoffDate } from '../../src/lib/db/clock';
import { clearReadCaches } from '../../src/lib/courses/facets';
import { loadFilterOptions } from '../../src/lib/courses/filter-options';
import { loadDiscoveryPage, loadHomepage } from '../../src/lib/courses/page';
import { formatCourseTitle } from '../../src/lib/courses/title';
import { registerSource } from '../../src/lib/db/ingestion';
import {
  listInstitutions,
  listMapCentres,
  MAP_CENTRES_LIMIT,
  findInstitution,
} from '../../src/lib/db/institutions';
import {
  loadCentrePage,
  loadDirectoryPage,
} from '../../src/lib/institutions/pages';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runIngestion } from '../../src/lib/ingestion/run';
import { parseMiramPage } from '../../src/lib/ingestion/adapters/miram';
import {
  listCourses,
  listLatestCourses,
  listCategories,
  listCentres,
} from '../../src/lib/db/courses';

const santAndreu = getSource('miram-sant-andreu');
const canBaste = getSource('miram-can-baste');

const migrationDirectory = new URL('../../migrations/', import.meta.url);
const migration = readdirSync(migrationDirectory)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => readFileSync(new URL(name, migrationDirectory), 'utf8'))
  .join('\n');
const fixture = readFileSync(
  new URL('../fixtures/miram-sant-andreu-languages.html', import.meta.url),
  'utf8',
);
const records = parseMiramPage(
  fixture,
  `${santAndreu.listingUrl}&f=ID`,
).records;

// SQL contract harness: real SQLite transactions, NOT a claim of workerd/D1 compatibility.
function sqliteContract(sqlite: DatabaseSync): D1Database {
  class Statement {
    values: (string | number | null)[] = [];
    constructor(readonly sql: string) {}
    bind(...values: (string | number | null)[]) {
      const next = new Statement(this.sql);
      next.values = values;
      return next;
    }
    async run() {
      return sqlite.prepare(this.sql).run(...this.values);
    }
    async all() {
      return { results: sqlite.prepare(this.sql).all(...this.values) };
    }
  }
  const db = {
    prepare: (sql: string) => new Statement(sql),
    async batch(statements: Statement[]) {
      sqlite.exec('BEGIN');
      try {
        const result = [];
        for (const statement of statements) result.push(await statement.run());
        sqlite.exec('COMMIT');
        return result;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  // Only methods used by the repository are implemented; runtime D1 has a separate suite.
  return db as unknown as D1Database;
}

describe('SQLite migration and ingestion contract', () => {
  let sqlite: DatabaseSync;
  let db: D1Database;
  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec(migration);
    db = sqliteContract(sqlite);
  });
  afterEach(() => {
    sqlite.close();
    vi.restoreAllMocks();
  });

  it('seeds reference locations, composes geographic filters and adds Asturias using data only', async () => {
    const active = records.map((record) => ({
      ...record,
      startDate: '2099-01-01',
      endDate: '2099-12-31',
    }));
    await runIngestion(db, { fetchRecords: async () => active }, santAndreu);
    const params = new URLSearchParams(
      'region=catalunya&city=barcelona&category=IDIOMES&centre=cc-sant-andreu&q=ANGLÈS&maxPrice=20',
    );
    const data = await loadDiscoveryPage(db, params);
    expect(data.status).toBe(200);
    expect(data.courses).toHaveLength(1);
    expect(data.filters.country).toBe('ES');
    const empty = await loadDiscoveryPage(
      db,
      new URLSearchParams('city=tarragona'),
    );
    expect(empty.status).toBe(200);
    expect(empty.courses).toEqual([]);
    expect(empty.centres).toEqual([]);
    expect(empty.categories).toEqual([]);
    expect(
      (await loadDiscoveryPage(db, new URLSearchParams('city=missing'))).status,
    ).toBe(400);
    sqlite.exec(
      "INSERT INTO regions VALUES ('asturias','ES','Asturias'); INSERT INTO cities VALUES ('oviedo','ES','asturias','Oviedo');",
    );
    clearGeographyCache(db);
    const stale = await loadDiscoveryPage(
      db,
      new URLSearchParams('region=asturias&city=barcelona&page=2&q=ANGLÈS'),
    );
    expect(stale.canonicalQuery).toBe('region=asturias&q=ANGL%C3%88S');
    const newSource = {
      ...canBaste,
      institution: {
        ...canBaste.institution,
        city: 'Oviedo',
        cityId: 'oviedo',
      },
    };
    await runIngestion(
      db,
      { fetchRecords: async () => [active[0]!] },
      newSource,
    );
    const asturias = await loadDiscoveryPage(
      db,
      new URLSearchParams('region=asturias&city=oviedo'),
    );
    expect(asturias.courses).toHaveLength(1);
    expect(asturias.centres.map((row) => row.id)).toEqual([
      canBaste.institution.id,
    ]);
    expect(asturias.categories).toEqual(['IDIOMES']);
    const before = sqlite
      .prepare('SELECT * FROM institutions WHERE id=?')
      .get(canBaste.institution.id);
    await expect(
      registerSource(db, {
        ...newSource,
        institution: { ...newSource.institution, country: 'FR' },
      }),
    ).rejects.toThrow('FOREIGN KEY');
    expect(
      sqlite
        .prepare('SELECT * FROM institutions WHERE id=?')
        .get(canBaste.institution.id),
    ).toEqual(before);
  });
  it('adds Alicante under Comunitat Valenciana with an honest empty discovery state', async () => {
    const data = await loadDiscoveryPage(
      db,
      new URLSearchParams('region=comunitat-valenciana&city=alicante'),
    );
    expect(data.status).toBe(200);
    expect(data.geography.regions).toContainEqual({
      id: 'comunitat-valenciana',
      country_code: 'ES',
      name: 'Comunitat Valenciana',
    });
    expect(data.geography.cities).toContainEqual({
      id: 'alicante',
      country_code: 'ES',
      region_id: 'comunitat-valenciana',
      name: 'Alicante',
    });
    expect(data.filters.region).toBe('comunitat-valenciana');
    expect(data.filters.city).toBe('alicante');
    expect(data.courses).toEqual([]);
    expect(data.centres).toEqual([]);
    expect(data.categories).toEqual([]);
    const stale = await loadDiscoveryPage(
      db,
      new URLSearchParams('region=catalunya&city=alicante'),
    );
    expect(stale.canonicalQuery).toBe('region=catalunya');
  });
  it('persists cancellation idempotently, filters and deprioritizes it, and excludes it from the homepage', async () => {
    const active = Array.from({ length: 13 }, (_, index) => ({
      ...records[0]!,
      externalId: String(70000 + index),
      title: `TEST running ${index}`,
      startDate: '2099-01-01',
      endDate: '2099-12-31',
    }));
    const cancelled = {
      ...records[0]!,
      externalId: '71000',
      title: 'TEST cancelled',
      isCancelled: true,
      priceCents: 0,
      startDate: '2098-01-01',
      endDate: '2099-12-31',
      category: 'CUINA',
    };
    const adapter = { fetchRecords: async () => [...active, cancelled] };
    await runIngestion(db, adapter, santAndreu);
    await runIngestion(db, adapter, santAndreu);
    expect(
      sqlite.prepare('SELECT count(*) AS count FROM course_editions').get(),
    ).toEqual({ count: 14 });
    const filters = {
      q: '',
      centre: '',
      category: '',
      maxPriceCents: null,
      page: 1,
    };
    const first = await listCourses(db, filters, '2026-11-07');
    expect(first.hasNext).toBe(true);
    expect(first.courses.every((course) => course.is_cancelled === 0)).toBe(
      true,
    );
    const second = await listCourses(db, { ...filters, page: 2 }, '2026-11-07');
    expect(second.courses.map((course) => course.is_cancelled)).toEqual([0, 1]);
    const only = await listCourses(
      db,
      { ...filters, cancellation: 'only' },
      '2026-11-07',
    );
    expect(only.courses).toHaveLength(1);
    expect(only.courses[0]).toMatchObject({
      title: cancelled.title,
      is_cancelled: 1,
      price_cents: 0,
    });
    const hidden = await listCourses(
      db,
      { ...filters, cancellation: 'hide', page: 2 },
      '2026-11-07',
    );
    expect(hidden.courses).toHaveLength(1);
    expect(hidden.courses[0]?.is_cancelled).toBe(0);
    const inMonth = (startMonth: string) =>
      listCourses(db, { ...filters, startMonth }, '2026-11-07');
    expect((await inMonth('2099-01')).courses).toHaveLength(12);
    expect((await inMonth('2098-01')).courses.map((c) => c.title)).toEqual([
      cancelled.title,
    ]);
    expect((await inMonth('2099-02')).courses).toEqual([]);
    expect(
      (await listLatestCourses(db, '2026-11-07')).every(
        (course) => course.is_cancelled === 0,
      ),
    ).toBe(true);
    const options = await loadFilterOptions(
      db,
      new URLSearchParams('cancellation=only'),
    );
    expect(options.categories).toEqual(['CUINA']);
    expect(options.centres.map((centre) => centre.id)).toEqual([
      santAndreu.institution.id,
    ]);
    const centre = await loadCentrePage(
      db,
      'sant-andreu',
      new URLSearchParams('page=2'),
    );
    expect(centre.courses.map((course) => course.is_cancelled)).toEqual([0, 1]);
    const failed = {
      fetchRecords: async () => {
        throw new Error('test source outage');
      },
    };
    await expect(runIngestion(db, failed, santAndreu)).rejects.toThrow(
      'test source outage',
    );
    expect(
      (
        await listCourses(
          db,
          { ...filters, cancellation: 'only' },
          '2026-11-06',
        )
      ).courses,
    ).toHaveLength(1);
    await runIngestion(
      db,
      { fetchRecords: async () => [{ ...cancelled, isCancelled: false }] },
      santAndreu,
    );
    expect(
      (
        await listCourses(
          db,
          { ...filters, cancellation: 'only' },
          '2026-11-06',
        )
      ).courses,
    ).toHaveLength(0);
    expect(
      (await loadDiscoveryPage(db, new URLSearchParams('cancellation=invalid')))
        .status,
    ).toBe(400);
  });
  it('backfills only explicitly reviewed institution IDs without guessing from addresses', () => {
    const legacy = new DatabaseSync(':memory:');
    try {
      for (const name of readdirSync(migrationDirectory)
        .filter((name) => name.endsWith('.sql') && name < '0005')
        .sort())
        legacy.exec(readFileSync(new URL(name, migrationDirectory), 'utf8'));
      const insert = legacy.prepare(
        'INSERT INTO institutions (id,name,official_url,city,country,address,timezone) VALUES (?,?,?,?,?,?,?)',
      );
      for (const id of ['cc-sant-andreu', 'unknown-centre'])
        insert.run(
          id,
          id,
          'https://example.org',
          'Barcelona',
          'ES',
          'Barcelona',
          'Europe/Madrid',
        );
      legacy.exec(
        readFileSync(
          new URL('0005_geographic_locations.sql', migrationDirectory),
          'utf8',
        ),
      );
      expect(
        legacy
          .prepare('SELECT institution_id,city_id FROM institution_locations')
          .all(),
      ).toEqual([{ institution_id: 'cc-sant-andreu', city_id: 'barcelona' }]);
    } finally {
      legacy.close();
    }
  });
  it('refreshes dependent filter options and clears an unavailable centre', async () => {
    const active = records.map((record) => ({
      ...record,
      startDate: '2099-01-01',
      endDate: '2099-12-31',
    }));
    await runIngestion(db, { fetchRecords: async () => active }, santAndreu);
    await runIngestion(
      db,
      { fetchRecords: async () => [{ ...active[0]!, category: 'CUINA' }] },
      canBaste,
    );
    const all = await loadFilterOptions(
      db,
      new URLSearchParams('city=barcelona'),
    );
    expect(all.centres).toHaveLength(2);
    expect(all.categories).toEqual(['CUINA', 'IDIOMES']);
    const scoped = await loadFilterOptions(
      db,
      new URLSearchParams('city=barcelona&centre=cc-can-baste'),
    );
    expect(scoped.centre).toBe('cc-can-baste');
    expect(scoped.categories).toEqual(['CUINA']);
    const empty = await loadFilterOptions(
      db,
      new URLSearchParams('city=tarragona&centre=cc-can-baste'),
    );
    expect(empty).toEqual({ centre: '', centres: [], categories: [] });
    expect(
      (
        await loadFilterOptions(
          db,
          new URLSearchParams('centre=unknown-centre'),
        )
      ).centre,
    ).toBe('');
    await expect(
      loadFilterOptions(db, new URLSearchParams('city=unknown')),
    ).rejects.toThrow('Unknown city');
  });
  it('registers verified profiles independently of courses and preserves reviewed descriptions', async () => {
    await registerSource(db, santAndreu);
    await registerSource(db, canBaste);
    expect(await listInstitutions(db)).toHaveLength(2);
    const centre = await findInstitution(db, 'sant-andreu');
    expect(centre?.latitude).toBe(41.43088018380354);
    expect(centre?.coordinates_source_url).toContain('guia.barcelona.cat');
    sqlite.exec(
      "UPDATE institution_profiles SET description='Reviewed description', description_language='ca' WHERE institution_id='cc-sant-andreu'",
    );
    await registerSource(db, santAndreu);
    expect((await findInstitution(db, 'sant-andreu'))?.description).toBe(
      'Reviewed description',
    );
    const data = await loadCentrePage(db, 'sant-andreu', new URLSearchParams());
    expect(data.status).toBe(200);
    expect(data.courses).toEqual([]);
    expect(
      (await loadCentrePage(db, 'unknown', new URLSearchParams())).status,
    ).toBe(404);
    expect(
      (await loadCentrePage(db, 'sant-andreu', new URLSearchParams('page=-1')))
        .status,
    ).toBe(400);
    expect(
      (await loadDirectoryPage(db, new URLSearchParams('page=1001'))).status,
    ).toBe(400);
    expect(() =>
      sqlite
        .prepare(
          'UPDATE institution_profiles SET latitude=91 WHERE institution_id=?',
        )
        .run('cc-sant-andreu'),
    ).toThrow();
    expect(() =>
      sqlite
        .prepare(
          'UPDATE institution_profiles SET longitude=NULL WHERE institution_id=?',
        )
        .run('cc-sant-andreu'),
    ).toThrow();
    expect(() =>
      sqlite
        .prepare(
          'UPDATE institution_profiles SET slug=? WHERE institution_id=?',
        )
        .run('can-baste', 'cc-sant-andreu'),
    ).toThrow();
  });
  it('paginates the full directory and distinguishes outages from missing centres', async () => {
    for (let index = 0; index < 25; index++) {
      await registerSource(db, {
        ...santAndreu,
        id: `test-source-${index}`,
        listingUrl: `https://example.org/test-source-${index}`,
        institution: {
          ...santAndreu.institution,
          id: `test-centre-${index}`,
          name: `Centre ${String(index).padStart(2, '0')}`,
        },
      });
    }
    const params = (query: string) => new URLSearchParams(query);
    const first = await loadDirectoryPage(db, params(''));
    const next = await loadDirectoryPage(db, params('page=2'));
    expect(first.centres).toHaveLength(24);
    expect(first.hasNext).toBe(true);
    expect(next.centres).toHaveLength(1);
    expect(next.hasNext).toBe(false);
    expect(
      new Set([...first.centres, ...next.centres].map((c) => c.id)).size,
    ).toBe(25);
    const found = await loadDirectoryPage(db, params('q=centre 07'));
    expect(found.centres.map((c) => c.name)).toEqual(['Centre 07']);
    const unavailable = {
      prepare: () => {
        throw new Error('database unavailable');
      },
    } as unknown as D1Database;
    expect(
      (await loadCentrePage(unavailable, 'test-centre', new URLSearchParams()))
        .status,
    ).toBe(503);
    expect(
      (await loadDirectoryPage(unavailable, new URLSearchParams())).status,
    ).toBe(503);
  });
  it('maps verified centres across directory pages, including centres without courses', async () => {
    await registerSource(db, santAndreu);
    for (let index = 0; index < 25; index++) {
      const id = `test-map-${index}`;
      sqlite
        .prepare(
          'INSERT INTO institutions (id,name,official_url,city,country,address,timezone) VALUES (?,?,?,?,?,?,?)',
        )
        .run(
          id,
          `TEST centre ${index}`,
          'https://example.org',
          'Barcelona',
          'ES',
          'TEST address',
          'Europe/Madrid',
        );
      sqlite
        .prepare(
          'INSERT INTO institution_profiles (institution_id,slug,latitude,longitude,coordinates_source_url,coordinates_verified_at) VALUES (?,?,?,?,?,?)',
        )
        .run(id, id, 41.4, 2.1, 'https://example.org/source', '2026-11-06');
    }
    const page = await loadDirectoryPage(db, new URLSearchParams('page=2'));
    expect(page.centres).toHaveLength(2);
    expect(page.mapCentres).toHaveLength(26);
    expect(
      page.mapCentres.some(
        (c) => !page.centres.some((listed) => listed.id === c.id),
      ),
    ).toBe(true);
    expect(page.mapHasMore).toBe(false);
    sqlite.exec(
      "UPDATE institution_profiles SET latitude=NULL,longitude=NULL,coordinates_source_url=NULL,coordinates_verified_at=NULL WHERE institution_id='test-map-0'",
    );
    sqlite.exec(
      "UPDATE institution_profiles SET coordinates_source_url='http://example.org/unverified' WHERE institution_id='test-map-1'",
    );
    sqlite.exec(
      "UPDATE institution_profiles SET coordinates_verified_at='' WHERE institution_id='test-map-2'",
    );
    const map = await listMapCentres(db);
    expect(map.mapCentres).toHaveLength(23);
    expect(map.mapCentres.find((c) => c.id === 'cc-sant-andreu')).toMatchObject(
      { latitude: 41.43088018380354, longitude: 2.1894124386376466 },
    );
    expect(await listInstitutions(db)).toHaveLength(26);
  });
  it('bounds map data and reports truncation explicitly', async () => {
    for (let index = 0; index < MAP_CENTRES_LIMIT + 1; index++) {
      const id = `test-limit-${index}`;
      sqlite
        .prepare(
          'INSERT INTO institutions (id,name,official_url,city,country,address,timezone) VALUES (?,?,?,?,?,?,?)',
        )
        .run(
          id,
          id,
          'https://example.org',
          'Barcelona',
          'ES',
          'TEST address',
          'Europe/Madrid',
        );
      sqlite
        .prepare(
          'INSERT INTO institution_profiles (institution_id,slug,latitude,longitude,coordinates_source_url,coordinates_verified_at) VALUES (?,?,?,?,?,?)',
        )
        .run(id, id, 41.4, 2.1, 'https://example.org/source', '2026-11-06');
    }
    const map = await listMapCentres(db);
    expect(map.mapCentres).toHaveLength(MAP_CENTRES_LIMIT);
    expect(map.mapHasMore).toBe(true);
  });
  it('preserves raw titles and provenance while exposing reviewed-title intent', async () => {
    await runIngestion(db, { fetchRecords: async () => records }, santAndreu);
    const filters = {
      q: '',
      category: '',
      centre: santAndreu.institution.id,
      maxPriceCents: null,
      page: 1,
    };
    const listing = await listCourses(db, filters, '2026-11-06');
    const original = listing.courses.find(
      (c) => c.title === 'CONVERSA EN ANGLÈS',
    )!;
    expect(original.title_reviewed).toBe(0);
    expect(formatCourseTitle(original.title, 'ca')).toBe('Conversa en anglès');
    const stored = sqlite
      .prepare(
        'SELECT title FROM courses WHERE id=(SELECT course_id FROM course_editions WHERE id=?)',
      )
      .get(original.id);
    expect(stored?.title).toBe('CONVERSA EN ANGLÈS');
    const payload = sqlite
      .prepare('SELECT payload_json FROM source_records WHERE edition_id=?')
      .get(original.id);
    expect(JSON.parse(String(payload?.payload_json)).title).toBe(
      'CONVERSA EN ANGLÈS',
    );
    sqlite
      .prepare('UPDATE courses SET reviewed_title=? WHERE title=?')
      .run('FOTOGRAFIA AMB JOAN', 'CONVERSA EN ANGLÈS');
    const reviewed = (
      await listCourses(db, filters, '2026-11-06')
    ).courses.find((c) => c.id === original.id)!;
    expect(reviewed.title_reviewed).toBe(1);
    expect(reviewed.title).toBe('FOTOGRAFIA AMB JOAN');
    expect(
      sqlite
        .prepare('SELECT title FROM courses WHERE title=?')
        .get('CONVERSA EN ANGLÈS')?.title,
    ).toBe('CONVERSA EN ANGLÈS');
  });
  it('writes only changed rows when a snapshot is re-imported unchanged', async () => {
    const adapter = { fetchRecords: async () => records };
    const changes = () =>
      Number(sqlite.prepare('SELECT total_changes() AS n').get()?.n);
    const before = changes();
    await runIngestion(db, adapter, santAndreu);
    const firstRun = changes() - before;
    const afterFirst = changes();
    await runIngestion(db, adapter, santAndreu);
    const unchanged = changes() - afterFirst;
    // Unchanged data rewrites no institution, source, profile, course or edition rows:
    // only each record's verification timestamps and the run's own two rows.
    expect(unchanged).toBe(records.length + 2);
    expect(firstRun).toBeGreaterThan(unchanged * 2);
    const afterSecond = changes();
    const repriced = records.map((record, index) =>
      index === 0 ? { ...record, priceCents: 12345 } : record,
    );
    await runIngestion(db, { fetchRecords: async () => repriced }, santAndreu);
    // One edition row changed in addition to the same timestamps.
    expect(changes() - afterSecond).toBe(records.length + 2 + 1);
    expect(
      sqlite
        .prepare(
          'SELECT price_cents AS p FROM course_editions ORDER BY price_cents DESC LIMIT 1',
        )
        .get()?.p,
    ).toBe(12345);
  });
  it('reads filter options once per window and again after the caches are cleared', async () => {
    const active = records.map((record) => ({
      ...record,
      startDate: '2099-01-01',
      endDate: '2099-12-31',
    }));
    await runIngestion(db, { fetchRecords: async () => active }, santAndreu);
    const prepare = vi.spyOn(db, 'prepare');
    const first = await loadDiscoveryPage(db, new URLSearchParams());
    expect(first.categories.length).toBeGreaterThan(0);
    // Different search text, price and page still need the same options.
    const queries = prepare.mock.calls.length;
    await loadDiscoveryPage(db, new URLSearchParams('q=anglès'));
    await loadDiscoveryPage(db, new URLSearchParams('maxPrice=50&page=1'));
    const sqlOf = (index: number) => String(prepare.mock.calls[index]?.[0]);
    const later = prepare.mock.calls
      .slice(queries)
      .map((_, i) => sqlOf(queries + i));
    // Only the course listing runs again: no geography, category or centre lookups.
    expect(later).toHaveLength(2);
    expect(later.every((sql) => sql.includes('FROM course_editions e'))).toBe(
      true,
    );
    clearReadCaches(db);
    const afterClear = prepare.mock.calls.length;
    await loadDiscoveryPage(db, new URLSearchParams());
    expect(prepare.mock.calls.length - afterClear).toBeGreaterThan(2);
  });
  it('derives the live cutoff from the time zones of the institutions in the database', async () => {
    const instant = new Date('2026-11-08T23:30:00Z');
    clearReadCaches(db);
    // No institution yet: fall back to UTC rather than a hard-coded place.
    expect(await liveCutoffDate(db, instant)).toBe('2026-11-08');
    await runIngestion(db, { fetchRecords: async () => records }, santAndreu);
    clearReadCaches(db);
    // Europe/Madrid is already on the 9th, so the cutoff follows the data.
    expect(await liveCutoffDate(db, instant)).toBe('2026-11-09');
    sqlite
      .prepare(
        "INSERT INTO institutions (id,name,official_url,city,country,address,timezone) VALUES ('x-bogota','Bogotá','https://example.org','Bogotá','CO','a','America/Bogota')",
      )
      .run();
    clearReadCaches(db);
    // An edition ending on the 8th stays listed until the 8th ends in Bogotá.
    expect(await liveCutoffDate(db, instant)).toBe('2026-11-08');
  });
  it('reports the latest successful run per source for ingestion planning', async () => {
    const adapter = { fetchRecords: async () => records };
    expect(
      await loadSourceStatuses(db as never, [santAndreu.id, 'miram-new']),
    ).toEqual([
      { id: santAndreu.id, lastSuccessAt: null },
      { id: 'miram-new', lastSuccessAt: null },
    ]);
    await runIngestion(db, adapter, santAndreu);
    const [first] = await loadSourceStatuses(db as never, [santAndreu.id]);
    expect(first?.lastSuccessAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // A failed attempt must not move the source to the back of the queue.
    await expect(
      runIngestion(
        db,
        {
          fetchRecords: async () => {
            throw new Error('source down');
          },
        },
        santAndreu,
      ),
    ).rejects.toThrow('source down');
    const [afterFailure] = await loadSourceStatuses(db as never, [
      santAndreu.id,
    ]);
    expect(afterFailure?.lastSuccessAt).toBe(first?.lastSuccessAt);
  });
  it('searches titles ignoring case, accents and Unicode composition while keeping stored titles', async () => {
    const titles = [
      'Fotografía digital',
      'CERÁMICA creativa',
      'Música en família',
      'Conversa en anglès',
    ];
    const titled = records.map((record, index) => ({
      ...record,
      title: (index === 3 ? 'Conversa en angle\u0300s' : titles[index])!,
      startDate: '2099-01-01',
      endDate: '2099-12-31',
    }));
    await runIngestion(db, { fetchRecords: async () => titled }, santAndreu);
    const search = async (q: string, extra = '') =>
      (
        await listCourses(
          db,
          parseFilters(
            new URLSearchParams(`q=${encodeURIComponent(q)}${extra}`),
          ),
          '2026-11-06',
        )
      ).courses.map((course) => course.title.normalize('NFC'));
    for (const [query, expected] of [
      ['fotografia', 'Fotografía digital'],
      ['FOTOGRAFÍA', 'Fotografía digital'],
      ['ceramica', 'CERÁMICA creativa'],
      ['cerámica', 'CERÁMICA creativa'],
      ['musica', 'Música en família'],
      ['familia', 'Música en família'],
      ['angles', 'Conversa en anglès'],
      ['ANGLÈS', 'Conversa en anglès'],
      ['angle\u0300s', 'Conversa en anglès'],
      ['conversa angl', 'Conversa en anglès'],
    ] as const)
      expect(await search(query), query).toEqual([expected]);
    expect(await search('inexistent')).toEqual([]);
    expect(await search('--')).toEqual([]);
    // Operators typed by users are text, not FTS5 syntax.
    expect(await search('musica OR ceramica')).toEqual([]);
    // Composes with the other filters and pagination.
    expect(await search('musica', '&maxPrice=0')).toEqual([]);
    expect(await search('musica', '&centre=cc-sant-andreu')).toEqual([
      'Música en família',
    ]);
    expect(await search('musica', '&page=2')).toEqual([]);
    // The stored titles keep their original accents.
    expect(
      sqlite
        .prepare('SELECT title FROM courses WHERE title LIKE ?')
        .get('Música%')?.title,
    ).toBe('Música en família');
    // Re-ingesting unchanged data and reviewing a title keep the index in sync.
    await runIngestion(db, { fetchRecords: async () => titled }, santAndreu);
    expect(await search('musica')).toEqual(['Música en família']);
    sqlite
      .prepare('UPDATE courses SET reviewed_title=? WHERE title=?')
      .run('Piano', 'Música en família');
    expect(await search('musica')).toEqual([]);
    expect(await search('PIANO')).toEqual(['Piano']);
    sqlite.exec('UPDATE courses SET reviewed_title=NULL');
    expect(await search('musica')).toEqual(['Música en família']);
    expect(
      sqlite.prepare('SELECT count(*) AS n FROM courses_fts').get()?.n,
    ).toBe(4);
  });
  it('shows the latest 20 unexpired additions by first seen, without refreshes reordering them', async () => {
    const clock = vi.spyOn(Date.prototype, 'toISOString');
    const ingestAt = async (items: typeof records, timestamp: string) => {
      clock.mockReturnValue(timestamp);
      await runIngestion(db, { fetchRecords: async () => items }, santAndreu);
    };
    const first = records[0]!;
    const older = [
      {
        ...first,
        externalId: '10000',
        title: 'TEST older',
        startDate: '2099-01-01',
        endDate: '2099-12-31',
      },
    ];
    await ingestAt(older, '2026-10-01T00:00:00.000Z');
    const added = Array.from({ length: 25 }, (_, index) => ({
      ...first,
      externalId: String(20000 + index),
      title: `TEST newly added ${index}`,
      startDate: '2099-01-01',
      endDate: '2099-12-31',
    }));
    await ingestAt([...older, ...added], '2026-11-01T00:00:00.000Z');
    const latest = await listLatestCourses(db, '2026-11-07');
    expect(latest).toHaveLength(20);
    expect(latest.map((c) => c.title)).toEqual(
      added.slice(0, 20).map((c) => c.title),
    );
    await ingestAt(older, '2026-11-07T00:00:00.000Z');
    expect(
      (await listLatestCourses(db, '2026-11-07')).map((c) => c.id),
    ).toEqual(latest.map((c) => c.id));
    await ingestAt(
      [
        {
          ...first,
          externalId: '30000',
          title: 'TEST expired addition',
          startDate: '2020-01-01',
          endDate: '2020-01-02',
        },
        {
          ...first,
          externalId: '30001',
          title: 'TEST unknown date',
          startDate: null,
          endDate: null,
        },
      ],
      '2026-11-07T01:00:00.000Z',
    );
    const withUnknown = await listLatestCourses(db, '2026-11-07');
    expect(withUnknown[0]?.title).toBe('TEST unknown date');
    expect(withUnknown.some((c) => c.title === 'TEST expired addition')).toBe(
      false,
    );
    const plan = sqlite
      .prepare(
        'EXPLAIN QUERY PLAN SELECT external_id FROM source_records ORDER BY first_seen_at DESC,source_id,external_id LIMIT 20',
      )
      .all();
    expect(
      plan.some((row) =>
        String(row.detail).includes('source_records_first_seen'),
      ),
    ).toBe(true);
  });
  it('handles empty and unavailable latest-course lists explicitly', async () => {
    expect(await loadHomepage(db)).toEqual({
      courses: [],
      error: null,
      status: 200,
    });
    const broken = {
      prepare: () => {
        throw new Error('database unavailable');
      },
    } as unknown as D1Database;
    expect(await loadHomepage(broken)).toEqual({
      courses: [],
      error: 'unavailable',
      status: 503,
    });
  });
  it('backfills stable centre slugs when upgrading existing data', () => {
    const legacy = new DatabaseSync(':memory:');
    try {
      const files = readdirSync(migrationDirectory)
        .filter((n) => n.endsWith('.sql'))
        .sort();
      for (const file of files.slice(0, 2))
        legacy.exec(readFileSync(new URL(file, migrationDirectory), 'utf8'));
      legacy
        .prepare(
          'INSERT INTO institutions (id,name,official_url,city,country,address,timezone) VALUES (?,?,?,?,?,?,?)',
        )
        .run(
          'cc-old',
          'Existing centre',
          'https://example.org',
          'Barcelona',
          'ES',
          'Existing address',
          'Europe/Madrid',
        );
      legacy.exec(
        readFileSync(
          new URL('0003_institution_profiles.sql', migrationDirectory),
          'utf8',
        ),
      );
      expect(
        legacy.prepare('SELECT slug,latitude FROM institution_profiles').get(),
      ).toMatchObject({ slug: 'old', latitude: null });
      expect(
        legacy.prepare('SELECT name FROM institutions').get(),
      ).toMatchObject({ name: 'Existing centre' });
    } finally {
      legacy.close();
    }
  });
  it('lists real categories and centres, and composes both filters without identity collisions', async () => {
    await runIngestion(db, { fetchRecords: async () => records }, santAndreu);
    await runIngestion(
      db,
      { fetchRecords: async () => [{ ...records[0]!, category: 'DANSA' }] },
      canBaste,
    );
    expect(await listCategories(db, '2026-11-05')).toEqual(['BALL', 'IDIOMES']);
    expect(
      await listCategories(db, '2026-11-05', santAndreu.institution.id),
    ).toEqual(['IDIOMES']);
    expect(
      await listCategories(db, '2026-11-05', canBaste.institution.id),
    ).toEqual(['BALL']);
    expect(await listCategories(db, '2026-11-05', 'unknown-centre')).toEqual(
      [],
    );
    expect(await listCentres(db, '2026-11-05')).toEqual([
      { id: canBaste.institution.id, name: canBaste.institution.name },
      { id: santAndreu.institution.id, name: santAndreu.institution.name },
    ]);
    const filters = {
      q: '',
      page: 1,
      maxPriceCents: null,
      category: 'IDIOMES',
      centre: santAndreu.institution.id,
    };
    expect((await listCourses(db, filters, '2026-11-05')).courses).toHaveLength(
      4,
    );
    expect(
      (
        await listCourses(
          db,
          { ...filters, centre: canBaste.institution.id },
          '2026-11-05',
        )
      ).courses,
    ).toHaveLength(0);
    expect(
      (
        await listCourses(
          db,
          { ...filters, category: 'DANSA', centre: canBaste.institution.id },
          '2026-11-05',
        )
      ).courses,
    ).toHaveLength(1);
    expect(
      (
        await listCourses(
          db,
          { ...filters, category: "' OR 1=1 --" },
          '2026-11-05',
        )
      ).courses,
    ).toHaveLength(0);
    expect(await listCategories(db, '2028-01-01')).toEqual([]);
    expect(await listCentres(db, '2028-01-01')).toEqual([]);
    expect(
      sqlite.prepare('SELECT count(*) AS n FROM course_editions').get()?.n,
    ).toBe(5);
  });
  it('groups photography aliases before pagination while preserving source labels', async () => {
    const aliases = [
      'FOTOGRAFIA',
      'ESPAI FOTOGRÀFIC',
      'ESPAI FOTOGRÀFIC PATI LLIMONA',
    ];
    const photos = Array.from({ length: 15 }, (_, index) => ({
      ...records[0]!,
      externalId: String(8000 + index),
      title: `TEST photo ${index}`,
      category: aliases[index % 3]!,
    }));
    await runIngestion(
      db,
      {
        fetchRecords: async () => [
          ...photos,
          {
            ...records[0]!,
            externalId: '9000',
            title: 'TEST other',
            category: 'CUINA',
          },
          {
            ...records[0]!,
            externalId: '9001',
            title: 'TEST expired',
            category: 'EXPIRED',
            endDate: '2020-01-01',
            startDate: '2019-01-01',
          },
        ],
      },
      santAndreu,
    );
    const filters = {
      q: 'TEST photo',
      page: 1,
      maxPriceCents: 6000,
      category: 'FOTOGRAFIA',
      centre: santAndreu.institution.id,
    };
    const firstPage = await listCourses(db, filters, '2026-11-05');
    expect(firstPage.courses).toHaveLength(12);
    expect(firstPage.hasNext).toBe(true);
    expect(
      firstPage.courses.every((course) => course.category === 'FOTOGRAFIA'),
    ).toBe(true);
    const secondPage = await listCourses(
      db,
      { ...filters, page: 2 },
      '2026-11-05',
    );
    expect(secondPage.courses).toHaveLength(3);
    expect(secondPage.hasNext).toBe(false);
    expect(
      await listCourses(
        db,
        { ...filters, category: aliases[2]!, page: 2 },
        '2026-11-05',
      ),
    ).toEqual(secondPage);
    expect(
      await listCategories(db, '2026-11-05', santAndreu.institution.id),
    ).toEqual(['CUINA', 'FOTOGRAFIA']);
    expect(
      sqlite
        .prepare(
          "SELECT DISTINCT category FROM courses WHERE category LIKE '%FOTOG%' ORDER BY category",
        )
        .all()
        .map((row) => row.category),
    ).toEqual([...aliases].sort());
  });
  it('merges expression and expression/creativity into one centre-scoped filter', async () => {
    const expression = ['Expressió', 'Expressió i creativitat'].map(
      (category, index) => ({
        ...records[0]!,
        externalId: String(8500 + index),
        title: `TEST expression ${index}`,
        category,
      }),
    );
    await runIngestion(
      db,
      { fetchRecords: async () => expression },
      santAndreu,
    );
    expect(
      await listCategories(db, '2026-11-06', santAndreu.institution.id),
    ).toEqual(['EXPRESSIÓ']);
    const filters = {
      q: '',
      page: 1,
      maxPriceCents: null,
      centre: santAndreu.institution.id,
      category: 'EXPRESSIÓ',
    };
    const grouped = await listCourses(db, filters, '2026-11-06');
    expect(grouped.courses).toHaveLength(2);
    expect(
      grouped.courses.every((course) => course.category === 'EXPRESSIÓ'),
    ).toBe(true);
    expect(
      await listCourses(
        db,
        { ...filters, category: 'Expressió i creativitat' },
        '2026-11-06',
      ),
    ).toEqual(grouped);
  });
  it('imports twice without duplicates, preserves provenance and reviewed titles', async () => {
    const adapter = { fetchRecords: async () => records };
    await runIngestion(db, adapter, santAndreu);
    const before = sqlite
      .prepare(
        'SELECT first_seen_at, content_hash FROM source_records ORDER BY external_id',
      )
      .all();
    sqlite.exec(
      "UPDATE courses SET reviewed_title='Reviewed title' WHERE title='CONVERSA EN ANGLÈS'",
    );
    await runIngestion(db, adapter, santAndreu);
    expect(
      sqlite.prepare('SELECT count(*) AS n FROM course_editions').get()?.n,
    ).toBe(4);
    expect(sqlite.prepare('SELECT count(*) AS n FROM courses').get()?.n).toBe(
      4,
    );
    expect(
      sqlite
        .prepare(
          'SELECT first_seen_at, content_hash FROM source_records ORDER BY external_id',
        )
        .all(),
    ).toEqual(before);
    expect(
      sqlite
        .prepare(
          "SELECT count(*) AS n FROM courses WHERE reviewed_title='Reviewed title'",
        )
        .get()?.n,
    ).toBe(1);
    expect(
      sqlite
        .prepare(
          "SELECT count(*) AS n FROM ingestion_runs WHERE status='succeeded'",
        )
        .get()?.n,
    ).toBe(2);
    const updated = records.map((record, index) =>
      index === 0
        ? { ...record, title: 'CONVERSA EN ANGLÈS (actualitzat)' }
        : record,
    );
    await runIngestion(db, { fetchRecords: async () => updated }, santAndreu);
    expect(sqlite.prepare('SELECT count(*) AS n FROM courses').get()?.n).toBe(
      4,
    );
    expect(
      sqlite
        .prepare(
          "SELECT reviewed_title FROM courses WHERE title='CONVERSA EN ANGLÈS (actualitzat)'",
        )
        .get()?.reviewed_title,
    ).toBe('Reviewed title');
  });
  it('keeps all previously verified data on network failure and records the failed run', async () => {
    await runIngestion(db, { fetchRecords: async () => records }, santAndreu);
    const before = sqlite
      .prepare('SELECT * FROM source_records ORDER BY external_id')
      .all();
    await expect(
      runIngestion(
        db,
        {
          fetchRecords: async () => {
            throw new Error('Network failure');
          },
        },
        santAndreu,
      ),
    ).rejects.toThrow('Network failure');
    expect(
      sqlite.prepare('SELECT * FROM source_records ORDER BY external_id').all(),
    ).toEqual(before);
    expect(
      sqlite
        .prepare("SELECT error FROM ingestion_runs WHERE status='failed'")
        .get()?.error,
    ).toBe('Network failure');
    await runIngestion(db, { fetchRecords: async () => records }, santAndreu);
    expect(
      sqlite.prepare('SELECT count(*) AS n FROM course_editions').get()?.n,
    ).toBe(4);
  });
  it('rolls back the whole snapshot if a database write fails', async () => {
    sqlite.exec(
      "CREATE TRIGGER reject_record BEFORE INSERT ON source_records WHEN NEW.external_id='1723' BEGIN SELECT RAISE(ABORT, 'test write failure'); END;",
    );
    await expect(
      runIngestion(db, { fetchRecords: async () => records }, santAndreu),
    ).rejects.toThrow('test write failure');
    expect(
      sqlite.prepare('SELECT count(*) AS n FROM course_editions').get()?.n,
    ).toBe(0);
    expect(sqlite.prepare('SELECT count(*) AS n FROM courses').get()?.n).toBe(
      0,
    );
    expect(
      sqlite
        .prepare(
          "SELECT count(*) AS n FROM ingestion_runs WHERE status='failed'",
        )
        .get()?.n,
    ).toBe(1);
  });
  it('does not delete records absent from a later snapshot and rejects invalid input', async () => {
    await runIngestion(db, { fetchRecords: async () => records }, santAndreu);
    await runIngestion(
      db,
      { fetchRecords: async () => records.slice(0, 1) },
      santAndreu,
    );
    expect(
      sqlite.prepare('SELECT count(*) AS n FROM course_editions').get()?.n,
    ).toBe(4);
    await expect(
      runIngestion(db, { fetchRecords: async () => [] }, santAndreu),
    ).rejects.toThrow('bound');
    expect(() =>
      sqlite
        .prepare(
          'INSERT INTO courses (id, institution_id, title) VALUES (?, ?, ?)',
        )
        .run('x', 'missing', 'title'),
    ).toThrow('FOREIGN KEY');
  });
  it('composes search and price filters and treats SQL patterns literally', async () => {
    await runIngestion(db, { fetchRecords: async () => records }, santAndreu);
    expect(
      (
        await listCourses(
          db,
          {
            q: 'ANGLÈS',
            page: 1,
            maxPriceCents: 2000,
            category: '',
            centre: '',
          },
          '2026-11-05',
        )
      ).courses,
    ).toHaveLength(1);
    expect(
      (
        await listCourses(
          db,
          { q: '%', page: 1, maxPriceCents: null, category: '', centre: '' },
          '2026-11-05',
        )
      ).courses,
    ).toHaveLength(0);
    expect(
      (
        await listCourses(
          db,
          {
            q: "' OR 1=1 --",
            page: 1,
            maxPriceCents: null,
            category: '',
            centre: '',
          },
          '2026-11-05',
        )
      ).courses,
    ).toHaveLength(0);
    expect(
      (
        await listCourses(
          db,
          { q: '', page: 1, maxPriceCents: null, category: '', centre: '' },
          '2028-01-01',
        )
      ).courses,
    ).toHaveLength(0);
  });
});
