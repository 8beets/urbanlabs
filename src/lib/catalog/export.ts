import type { IngestionDatabase } from '../db/ingestion-port';
import {
  SNAPSHOT_VERSION,
  snapshotSchema,
  type Snapshot,
  type SnapshotEdition,
} from './types';

// Keyset pages stay well below Wrangler's JSON output buffer on the remote bridge.
const EDITION_PAGE = 500;
// A guard against an unbounded export; raise it deliberately with the index budget.
export const SNAPSHOT_EDITION_LIMIT = 50_000;
const CATALOG_LIMIT = 1000;
export const MAP_CENTRES_LIMIT = 500;

async function rows<T>(
  db: IngestionDatabase,
  sql: string,
  ...values: (string | number)[]
): Promise<T[]> {
  return (
    await db
      .prepare(sql)
      .bind(...values)
      .all<T>()
  ).results;
}

function bounded<T>(list: T[], limit: number, what: string): T[] {
  if (list.length > limit)
    throw new Error(`${what} exceeds the bounded snapshot size (${limit})`);
  return list;
}

const editionColumns = `e.id, coalesce(c.reviewed_title, c.title) AS title,
  CASE WHEN c.reviewed_title IS NOT NULL THEN 1 ELSE 0 END AS title_reviewed, c.category,
  i.name AS institution, i.id AS institution_id, coalesce(p.slug, i.id) AS institution_slug,
  e.start_date, e.end_date, e.schedule_text, e.price_cents, e.currency, e.is_cancelled, e.is_sold_out, e.organizer,
  sr.official_url, sr.last_successfully_verified_at,
  sr.first_seen_at, sr.source_id, sr.external_id`;

async function exportEditions(
  db: IngestionDatabase,
): Promise<SnapshotEdition[]> {
  const editions: SnapshotEdition[] = [];
  let after: [string, string] = ['', ''];
  for (;;) {
    // Walks source_records by its primary key, so pages never skip or repeat a row.
    const page = await rows<SnapshotEdition>(
      db,
      `SELECT ${editionColumns} FROM source_records sr
      JOIN course_editions e ON e.id=sr.edition_id
      JOIN courses c ON c.id=e.course_id JOIN institutions i ON i.id=c.institution_id
      LEFT JOIN institution_profiles p ON p.institution_id=i.id
      WHERE sr.source_id > ? OR (sr.source_id = ? AND sr.external_id > ?)
      ORDER BY sr.source_id, sr.external_id LIMIT ?`,
      after[0],
      after[0],
      after[1],
      EDITION_PAGE,
    );
    editions.push(...page);
    bounded(editions, SNAPSHOT_EDITION_LIMIT, 'Course editions');
    if (page.length < EDITION_PAGE) return editions;
    const last = page[page.length - 1]!;
    after = [last.source_id, last.external_id];
  }
}

/**
 * Reads everything the static build publishes, using only bounded read queries.
 * Works against a D1 binding, the Node SQLite test harness or the remote Wrangler
 * bridge. The result is validated, so a schema drift fails the build, not the page.
 */
export async function exportSnapshot(
  db: IngestionDatabase,
  now: Date = new Date(),
): Promise<Snapshot> {
  const timeZones = await rows<{ timezone: string }>(
    db,
    'SELECT DISTINCT timezone FROM institutions ORDER BY timezone LIMIT ?',
    CATALOG_LIMIT + 1,
  );
  const [countries, regions, cities] = await Promise.all([
    rows(
      db,
      'SELECT code,name FROM countries ORDER BY name,code LIMIT ?',
      CATALOG_LIMIT + 1,
    ),
    rows(
      db,
      'SELECT id,country_code,name FROM regions ORDER BY name,id LIMIT ?',
      CATALOG_LIMIT + 1,
    ),
    rows(
      db,
      'SELECT id,country_code,region_id,name FROM cities ORDER BY name,id LIMIT ?',
      CATALOG_LIMIT + 1,
    ),
  ]);
  const locations = await rows(
    db,
    `SELECT il.institution_id, il.country_code, il.city_id, lc.region_id
    FROM institution_locations il JOIN cities lc ON lc.id=il.city_id AND lc.country_code=il.country_code
    ORDER BY il.institution_id LIMIT ?`,
    CATALOG_LIMIT + 1,
  );
  const centres = await rows(
    db,
    `SELECT i.id, p.slug, i.name, i.address, i.city, i.country, i.official_url,
      p.description, p.description_language, p.phone, p.email, p.details_source_url,
      p.details_verified_at, p.notice, p.latitude, p.longitude, p.coordinates_source_url,
      p.coordinates_verified_at
    FROM institutions i JOIN institution_profiles p ON p.institution_id=i.id
    ORDER BY i.name, i.id LIMIT ?`,
    CATALOG_LIMIT + 1,
  );
  const mapCentres = await rows(
    db,
    `SELECT i.id, p.slug, i.name, p.latitude, p.longitude
    FROM institution_profiles p JOIN institutions i ON i.id=p.institution_id
    WHERE p.latitude BETWEEN -90 AND 90 AND p.longitude BETWEEN -180 AND 180
      AND p.coordinates_source_url LIKE 'https://%'
      AND p.coordinates_verified_at IS NOT NULL AND p.coordinates_verified_at <> ''
    ORDER BY i.name, i.id LIMIT ?`,
    MAP_CENTRES_LIMIT + 1,
  );
  const editions = await exportEditions(db);
  return snapshotSchema.parse({
    version: SNAPSHOT_VERSION,
    generatedAt: now.toISOString(),
    timeZones: bounded(timeZones, CATALOG_LIMIT, 'Time zones').map(
      (row) => row.timezone,
    ),
    geography: {
      countries: bounded(countries, CATALOG_LIMIT, 'Countries'),
      regions: bounded(regions, CATALOG_LIMIT, 'Regions'),
      cities: bounded(cities, CATALOG_LIMIT, 'Cities'),
    },
    locations: bounded(locations, CATALOG_LIMIT, 'Locations'),
    centres: bounded(centres, CATALOG_LIMIT, 'Centres'),
    map: {
      mapCentres: mapCentres.slice(0, MAP_CENTRES_LIMIT),
      mapHasMore: mapCentres.length > MAP_CENTRES_LIMIT,
    },
    editions,
  });
}
