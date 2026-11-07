import { readFileSync, readdirSync } from 'node:fs';
import { getPlatformProxy } from 'wrangler';
import { runIngestion } from '../../src/lib/ingestion/run';
import { parseMiramPage } from '../../src/lib/ingestion/adapters/miram';
import { santAndreu } from '../../src/lib/sources/sant-andreu';
import { canBaste } from '../../src/lib/sources/can-baste';
import { patiLlimona } from '../../src/lib/sources/pati-llimona';
import { golferichs } from '../../src/lib/sources/golferichs';
import { selectSources } from '../../src/lib/sources';

async function setup() {
  const platform = await getPlatformProxy<Cloudflare.Env>({
    configPath: 'wrangler.jsonc',
    persist: { path: '.wrangler/e2e-state/v3' },
    remoteBindings: false,
  });
  try {
    const db = platform.env.DB;
    const directory = new URL('../../migrations/', import.meta.url);
    // E2E has a dedicated state directory and server port; browsing data is never seeded.
    await db
      .prepare(
        'CREATE TABLE IF NOT EXISTS e2e_migrations (name TEXT PRIMARY KEY)',
      )
      .run();
    for (const file of readdirSync(directory)
      .filter((name) => name.endsWith('.sql'))
      .sort()) {
      const sql = readFileSync(new URL(file, directory), 'utf8');
      const applied = await db
        .prepare('SELECT name FROM e2e_migrations WHERE name=?')
        .bind(file)
        .first();
      if (!applied) {
        await db.batch([
          ...sql
            .split(';')
            .map((query) => query.trim())
            .filter(Boolean)
            .map((query) => db.prepare(query)),
          db.prepare('INSERT INTO e2e_migrations (name) VALUES (?)').bind(file),
        ]);
      }
    }
    // Deliberately missing location, isolated in E2E state to exercise the honest fallback.
    await db
      .prepare(
        "INSERT OR IGNORE INTO institutions (id,name,official_url,city,country,address,timezone) VALUES ('test-no-location','TEST unverified location','https://example.org','Barcelona','ES','TEST address','Europe/Madrid')",
      )
      .run();
    await db
      .prepare(
        "INSERT OR IGNORE INTO institution_profiles (institution_id,slug) VALUES ('test-no-location','test-no-location')",
      )
      .run();
    const fixture = readFileSync(
      new URL('../fixtures/miram-sant-andreu-languages.html', import.meta.url),
      'utf8',
    );
    // Synthetic dates/extra records test navigation and pagination, exclusively in E2E state.
    const records = parseMiramPage(
      fixture,
      `${santAndreu.listingUrl}&f=ID`,
    ).records.map((record) => ({
      ...record,
      startDate: '2099-01-01',
      endDate: '2099-12-31',
    }));
    const first = records[0]!;
    const paginationRecords = Array.from({ length: 13 }, (_, index) => ({
      ...first,
      externalId: String(90000 + index),
      title: `TEST pagination workshop ${index}`,
      priceCents: 1000,
    }));
    const dance = {
      ...first,
      externalId: '99999',
      title: 'TEST dance workshop',
      category: 'BALL',
    };
    await runIngestion(
      db,
      { fetchRecords: async () => [...records, ...paginationRecords, dance] },
      santAndreu,
    );
    await runIngestion(
      db,
      {
        fetchRecords: async () => [
          {
            ...first,
            externalId: '99998',
            title: 'TEST second centre language workshop',
          },
          {
            ...first,
            externalId: '99995',
            title: 'TEST photo Can Basté',
            category: 'ESPAI FOTOGRÀFIC',
          },
        ],
      },
      canBaste,
    );
    const patiFixture = readFileSync(
      new URL('../fixtures/miram-pati-llimona-cinema.html', import.meta.url),
      'utf8',
    );
    const patiRecords = parseMiramPage(
      patiFixture,
      `${patiLlimona.listingUrl}&f=2`,
    ).records.map((record) => ({
      ...record,
      startDate: '2099-01-01',
      endDate: '2099-12-31',
    }));
    const cancelledRecords = parseMiramPage(
      readFileSync(
        new URL(
          '../fixtures/miram-pati-llimona-cancelled.html',
          import.meta.url,
        ),
        'utf8',
      ),
      `${patiLlimona.listingUrl}&f=11`,
    ).records.map((record) => ({
      ...record,
      startDate: '2099-01-01',
      endDate: '2099-12-31',
    }));
    await runIngestion(
      db,
      {
        fetchRecords: async () => [
          ...patiRecords,
          ...cancelledRecords,
          {
            ...first,
            externalId: '99996',
            title: 'TEST photo general',
            category: 'FOTOGRAFIA',
          },
          {
            ...first,
            externalId: '99997',
            title: 'TEST photo Pati Llimona',
            category: 'ESPAI FOTOGRÀFIC PATI LLIMONA',
          },
        ],
      },
      patiLlimona,
    );
    const golferichsRecords = ['photography', 'cooking'].flatMap((category) => {
      const html = readFileSync(
        new URL(
          `../fixtures/miram-golferichs-${category}.html`,
          import.meta.url,
        ),
        'utf8',
      );
      return parseMiramPage(
        html,
        `${golferichs.listingUrl}&f=${category === 'photography' ? 'XX' : 'CU'}`,
      ).records.map((record) => ({
        ...record,
        startDate: '2099-01-01',
        endDate: '2099-12-31',
      }));
    });
    await runIngestion(
      db,
      { fetchRecords: async () => golferichsRecords },
      golferichs,
    );
    const newFixtures = [
      ['miram-casa-elizalde', 'miram-casa-elizalde.html', 'H2'],
      ['miram-albareda', 'miram-albareda-music-first.html', '02'],
      ['miram-el-sortidor', 'miram-sortidor-family.html', 'TI'],
      ['miram-vil-la-urania', 'miram-vil-la-urania.html', 'AC'],
      ['miram-urgell', 'miram-urgell.html', 'H'],
      ['miram-fab-casa-del-rellotge', 'miram-fab-casa-del-rellotge.html', '01'],
      ['miram-fab-casa-del-mig', 'miram-fab-casa-del-mig.html', '01'],
    ];
    for (const [id, file, category] of newFixtures) {
      const source = selectSources(id)[0]!;
      const html = readFileSync(
        new URL(`../fixtures/${file}`, import.meta.url),
        'utf8',
      );
      const fixtureRecords = parseMiramPage(
        html,
        `${source.listingUrl}&f=${category}`,
      ).records.map((record) => ({
        ...record,
        startDate: '2099-01-01',
        endDate: '2099-12-31',
      }));
      await runIngestion(
        db,
        { fetchRecords: async () => fixtureRecords },
        source,
      );
    }
    // Isolated reviewed-title fixture: display must preserve the maintainer's explicit casing.
    await db
      .prepare(
        "UPDATE courses SET reviewed_title='TEST REVIEWED COURSE: JOAN' WHERE title='TEST dance workshop'",
      )
      .run();
  } finally {
    await platform.dispose();
  }
}

await setup();
