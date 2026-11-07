import { readFileSync, readdirSync } from 'node:fs';
import { getPlatformProxy } from 'wrangler';
import { expect, it } from 'vitest';
import { runIngestion } from '../../src/lib/ingestion/run';
import { parseMiramPage } from '../../src/lib/ingestion/adapters/miram';
import { santAndreu } from '../../src/lib/sources/sant-andreu';
import {
  findInstitution,
  listMapCentres,
  listInstitutions,
} from '../../src/lib/db/institutions';
import {
  listCategories,
  listCourses,
  listLatestCourses,
} from '../../src/lib/db/courses';

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
    await db.batch(
      migration
        .split(';')
        .map((sql) => sql.trim())
        .filter(Boolean)
        .map((sql) => db.prepare(sql)),
    );
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
    expect((await findInstitution(db, 'sant-andreu'))?.latitude).toBe(
      41.43088018380354,
    );
    expect((await listInstitutions(db, 1)).centres).toHaveLength(1);
    expect((await listMapCentres(db)).mapCentres).toMatchObject([
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
    ).toEqual(['FOTOGRAFIA']);
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
      grouped.courses.every((course) => course.category === 'FOTOGRAFIA'),
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
  } finally {
    await platform.dispose();
  }
});
