import { getSource } from '../../src/lib/sources';
import { readFileSync, readdirSync } from 'node:fs';
import { getPlatformProxy } from 'wrangler';
import { expect, it } from 'vitest';
import { splitStatements } from '../helpers/split-sql';
import { runIngestion } from '../../src/lib/ingestion/run';
import { parseMiramPage } from '../../src/lib/ingestion/adapters/miram';
import { listNewCourses } from '../../src/lib/db/courses';
import {
  listCategories,
  listCourses,
  listLatestCourses,
  snapshotOf,
} from '../helpers/catalog';
import {
  confirmSubscription,
  findSubscription,
  insertPendingSubscription,
  listDueSubscriptions,
  markDigestsSent,
} from '../../src/lib/db/subscriptions';

const santAndreu = getSource('miram-sant-andreu');

it('applies the migration and imports idempotently in the actual local D1 runtime', async () => {
  const platform = await getPlatformProxy<Cloudflare.Env>({
    configPath: 'wrangler.jsonc',
    persist: false,
  });
  try {
    const db = platform.env.DB;
    const directory = new URL('../../migrations/', import.meta.url);
    const migration = readdirSync(directory)
      .filter((name) => name.endsWith('.sql'))
      .sort()
      .map((name) => readFileSync(new URL(name, directory), 'utf8'))
      .join('\n');
    await db.batch(splitStatements(migration).map((sql) => db.prepare(sql)));
    const fixture = readFileSync(
      new URL('../fixtures/miram-sant-andreu-languages.html', import.meta.url),
      'utf8',
    );
    const records = parseMiramPage(
      fixture,
      `${santAndreu.listingUrl}&f=ID`,
    ).records;
    const adapter = { fetchRecords: async () => records };
    await runIngestion(db, adapter, santAndreu);
    // The static build's snapshot export runs its queries on the actual D1 runtime.
    const snapshot = await snapshotOf(db);
    expect(
      snapshot.centres.find((centre) => centre.slug === 'sant-andreu')
        ?.latitude,
    ).toBe(41.43088018380354);
    expect(snapshot.centres).toHaveLength(1);
    expect(snapshot.editions).toHaveLength(records.length);
    expect(snapshot.map.mapCentres).toMatchObject([
      {
        slug: 'sant-andreu',
        latitude: 41.43088018380354,
        longitude: 2.1894124386376466,
      },
    ]);
    await runIngestion(db, adapter, santAndreu);
    expect(
      await db.prepare('SELECT count(*) AS n FROM source_records').first('n'),
    ).toBe(4);
    const cancelled = { ...records[0]!, isCancelled: true };
    await runIngestion(
      db,
      { fetchRecords: async () => [cancelled] },
      santAndreu,
    );
    const cancellationFilters = {
      q: '',
      page: 1,
      maxPriceCents: null,
      category: '',
      centre: '',
      cancellation: 'only' as const,
    };
    const cancelledListing = await listCourses(
      db,
      cancellationFilters,
      '2026-11-06',
    );
    expect(cancelledListing.courses).toHaveLength(1);
    expect(cancelledListing.courses[0]?.is_cancelled).toBe(1);
    expect(await listLatestCourses(db, '2026-11-06')).toHaveLength(3);
    // Restore the source record for the remaining category/query contract checks.
    await runIngestion(db, adapter, santAndreu);
    await runIngestion(
      db,
      {
        fetchRecords: async () =>
          records.map((record, index) => ({
            ...record,
            category:
              index % 2 ? 'FOTOGRAFIA' : 'ESPAI FOTOGRÀFIC PATI LLIMONA',
          })),
      },
      santAndreu,
    );
    expect(
      await listCategories(db, '2026-11-06', santAndreu.institution.id),
    ).toEqual(['fotografia-i-audiovisual']);
    expect(await listCategories(db, '2026-11-06', 'unknown-centre')).toEqual(
      [],
    );
    const grouped = await listCourses(
      db,
      {
        q: '',
        page: 1,
        maxPriceCents: null,
        category: 'ESPAI FOTOGRÀFIC',
        centre: santAndreu.institution.id,
      },
      '2026-11-06',
    );
    expect(grouped.courses).toHaveLength(4);
    const geographic = {
      ...{ q: '', page: 1, maxPriceCents: null, category: '', centre: '' },
      country: 'ES',
      region: 'catalunya',
      city: 'barcelona',
    };
    expect(
      (await listCourses(db, geographic, '2026-11-06')).courses,
    ).toHaveLength(4);
    expect(
      (
        await listCourses(
          db,
          { ...geographic, city: 'tarragona' },
          '2026-11-06',
        )
      ).courses,
    ).toHaveLength(0);
    expect(
      await listCategories(db, '2026-11-06', '', { city: 'tarragona' }),
    ).toEqual([]);
    expect(await listLatestCourses(db, '2026-11-06')).toHaveLength(4);
    expect(
      grouped.courses.every(
        (course) => course.category === 'fotografia-i-audiovisual',
      ),
    ).toBe(true);
    await expect(
      runIngestion(
        db,
        {
          fetchRecords: async () => {
            throw new Error('source unavailable');
          },
        },
        santAndreu,
      ),
    ).rejects.toThrow('source unavailable');
    expect(
      await db.prepare('SELECT count(*) AS n FROM source_records').first('n'),
    ).toBe(4);

    // Alert subscriptions: the expression unique index and the repository SQL in real D1.
    const alert = {
      email: 'ana@example.org',
      locale: 'es' as const,
      category: null,
      countryCode: 'ES',
      cityId: 'barcelona',
    };
    const id = crypto.randomUUID();
    await insertPendingSubscription(db, id, alert, '2020-01-01T00:00:00.000Z');
    await insertPendingSubscription(
      db,
      crypto.randomUUID(),
      alert,
      '2020-01-01T00:00:00.000Z',
    );
    expect((await findSubscription(db, alert.email, alert))?.id).toBe(id);
    await confirmSubscription(db, id, '2020-01-02T00:00:00.000Z');
    expect(
      (await listDueSubscriptions(db, '2020-01-09T00:00:00.000Z', 10)).map(
        (row) => row.id,
      ),
    ).toEqual([id]);
    const fresh = await listNewCourses(
      db,
      '2020-01-01T00:00:00.000Z',
      '2026-11-06',
    );
    expect(fresh.courses).toHaveLength(4);
    expect(fresh.courses.every((course) => course.cityId === 'barcelona')).toBe(
      true,
    );
    await markDigestsSent(db, [id], '2020-01-09T00:00:00.000Z');
    expect(
      await listDueSubscriptions(db, '2020-01-09T00:00:00.000Z', 10),
    ).toHaveLength(1);
    expect(
      await listDueSubscriptions(db, '2020-01-08T23:59:59.000Z', 10),
    ).toHaveLength(0);
  } finally {
    await platform.dispose();
  }
});
