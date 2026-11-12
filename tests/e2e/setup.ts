import { getSource } from '../../src/lib/sources';
import { splitStatements } from '../helpers/split-sql';
import { getPlatformProxy } from 'wrangler';
import { runIngestion } from '../../src/lib/ingestion/run';
import { parseMiramPage } from '../../src/lib/ingestion/adapters/miram';
import { selectSources, sources } from '../../src/lib/sources';
import { universidadRecords } from '../helpers/zaragoza';
import { E2E_ALERT_IDS } from './alert-fixtures';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { exportSnapshot } from '../../src/lib/catalog/export';

// The static build reads this snapshot of the seeded E2E database.
export const E2E_SNAPSHOT = '.cache/e2e-snapshot.json';

const santAndreu = getSource('miram-sant-andreu');
const canBaste = getSource('miram-can-baste');
const patiLlimona = getSource('miram-pati-llimona');
const golferichs = getSource('miram-golferichs');

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
          ...splitStatements(sql).map((query) => db.prepare(query)),
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
    // Its city (pages live under it) is known; only the map coordinates are missing.
    await db
      .prepare(
        "INSERT OR IGNORE INTO institution_locations (institution_id,country_code,city_id) VALUES ('test-no-location','ES','barcelona')",
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
      {
        fetchRecords: async () => [
          ...records,
          ...paginationRecords,
          dance,
          {
            ...first,
            externalId: '99990',
            title: 'TEST finished workshop',
            startDate: '2020-01-01',
            endDate: '2020-02-01',
          },
        ],
      },
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
      ['miram-fort-pienc', 'miram-fort-pienc-languages.html', 'ID'],
      ['miram-barceloneta', 'miram-barceloneta-circus.html', '01'],
      ['miram-can-castello', 'miram-can-castello-dance.html', '04'],
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
    // These centres have no saved course fixture that is safe to reuse (Baró de Viver's
    // only one is an excluded childcare service; the others share Miram's markup with
    // fixtures above), so each gets one explicitly synthetic course in this isolated state.
    for (const [index, id] of [
      'miram-baro-de-viver',
      'miram-la-sedeta',
      'miram-navas',
      'miram-parc-sandaru',
      'miram-pere-pruna',
      'miram-trinitat-vella',
      'miram-vallvidrera-vazquez-montalban',
      'miram-vil-la-florida',
      'miram-zona-nord',
      'miram-la-farinera-del-clot',
      'miram-can-clariana-cultural',
      'miram-can-deu',
      'miram-can-felipa',
      'miram-casa-groga',
      'miram-casa-orlandai',
      'miram-convent-de-sant-agusti',
      'miram-cotxeres-borrell',
      'miram-besos-i-el-maresme',
      'miram-bon-pastor',
      'miram-drassanes',
      'miram-el-carmel',
      'miram-el-coll-la-bruguera',
      'miram-font-de-la-guatlla',
      'miram-guinardo',
      'miram-joan-oliver-pere-quart',
      'miram-l-electric',
      'miram-la-sagrera-la-barraca',
      'miram-sagrada-familia',
      'miram-sant-marti',
      'miram-teixonera',
      'miram-tomasa-cuevas-les-corts',
      'miram-torre-llobeta',
    ].entries()) {
      const source = getSource(id);
      await runIngestion(
        db,
        {
          fetchRecords: async () => [
            {
              ...first,
              externalId: String(99994 - index * 10),
              title: `TEST family workshop ${source.institution.name}`,
            },
          ],
        },
        source,
      );
    }
    // Zaragoza: the saved Universidad listing, and one explicitly synthetic course for
    // every other civic centre so each active source has a centre page and marker.
    const universidad = universidadRecords().map((record) => ({
      ...record,
      startDate: '2099-01-01',
      endDate: '2099-12-31',
    }));
    for (const source of sources.filter(
      (s) => s.platform === 'zaragoza-centros-civicos',
    )) {
      const place = source.centreCode!;
      const zaragozaRecords =
        place === 2119
          ? universidad
          : [
              {
                ...universidad[0]!,
                externalId: `99${place}`,
                title: `TEST workshop ${source.institution.name}`,
                officialUrl: source.institution.url,
              },
            ];
      await runIngestion(
        db,
        { fetchRecords: async () => zaragozaRecords },
        source,
      );
    }
    // Isolated reviewed-title fixture: display must preserve the maintainer's explicit casing.
    await db
      .prepare(
        "UPDATE courses SET reviewed_title='TEST REVIEWED COURSE: JOAN' WHERE title='TEST dance workshop'",
      )
      .run();
    // Pending alert subscriptions, one per Playwright project, reset on every run so the
    // confirm/unsubscribe flow starts from the same state. Synthetic addresses only.
    for (const id of E2E_ALERT_IDS)
      await db
        .prepare(
          `INSERT OR REPLACE INTO alert_subscriptions(id,email,locale,category,country_code,city_id,status,created_at)
          VALUES (?, ?, 'es', 'idiomes', 'ES', 'barcelona', 'pending', '2099-01-01T00:00:00.000Z')`,
        )
        .bind(id, `test-${id}@example.invalid`)
        .run();
    mkdirSync('.cache', { recursive: true });
    writeFileSync(E2E_SNAPSHOT, JSON.stringify(await exportSnapshot(db)));
  } finally {
    await platform.dispose();
  }
}

await setup();
