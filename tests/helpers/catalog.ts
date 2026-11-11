import { exportSnapshot } from '../../src/lib/catalog/export';
import { discover, filterOptions } from '../../src/lib/catalog/discovery';
import * as query from '../../src/lib/catalog/query';
import type { DiscoveryFilters } from '../../src/lib/catalog/types';
import type { GeographicFilters } from '../../src/lib/locations/geography';

// The former D1 discovery queries now run over a snapshot of the database. These
// helpers take a snapshot of the test database first, so the integration tests
// exercise the real export queries and the pure discovery code together.

type Db = Parameters<typeof exportSnapshot>[0];
type Facets = GeographicFilters &
  Pick<DiscoveryFilters, 'cancellation' | 'archive'>;

export const snapshotOf = (db: Db, now = new Date()) => exportSnapshot(db, now);

export async function listCourses(
  db: Db,
  filters: DiscoveryFilters,
  today: string,
) {
  const { courses, hasNext } = query.listCourses(
    await snapshotOf(db),
    filters,
    today,
  );
  return { courses, hasNext };
}

export async function listLatestCourses(db: Db, today: string) {
  return query.listLatestCourses((await snapshotOf(db)).editions, today);
}

export async function listCategories(
  db: Db,
  today: string,
  centre = '',
  facets: Facets = {},
) {
  return query.listCategories(await snapshotOf(db), today, centre, facets);
}

export async function listCentres(db: Db, today: string, facets: Facets = {}) {
  return query.listCentres(await snapshotOf(db), today, facets);
}

/** The search page for a query string, as the browser computes it. */
export async function loadDiscoveryPage(
  db: Db,
  params: URLSearchParams,
  now = new Date(),
) {
  const snapshot = await snapshotOf(db, now);
  const data = discover(snapshot, params, query.catalogToday(snapshot, now));
  return { ...data, status: data.error ? 400 : 200 };
}

export async function loadFilterOptions(
  db: Db,
  params: URLSearchParams,
  now = new Date(),
) {
  const snapshot = await snapshotOf(db, now);
  return filterOptions(snapshot, params, query.catalogToday(snapshot, now));
}
