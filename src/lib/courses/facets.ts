import { TtlMemo } from '../cache/ttl-memo';
import {
  listCategories,
  listCentres,
  madridToday,
  type CentreListing,
  type DiscoveryFilters,
} from '../db/courses';
import { clearCentreCaches } from '../institutions/pages';
import { clearGeographyCache } from '../locations/geography';

type FacetFilters = Pick<
  DiscoveryFilters,
  'country' | 'region' | 'city' | 'cancellation'
>;

// Category and centre options depend only on geography, cancellation (and the selected
// centre for categories) — not on search text, price or page — so every distinct
// search URL used to repeat identical queries. Five minutes matches the page cache.
const FACET_TTL_MS = 5 * 60 * 1000;
const categories = new TtlMemo<string[]>(FACET_TTL_MS, 200);
const centres = new TtlMemo<CentreListing[]>(FACET_TTL_MS, 100);

function key(today: string, filters: FacetFilters, centre = ''): string {
  return JSON.stringify([
    today,
    filters.country ?? '',
    filters.region ?? '',
    filters.city ?? '',
    filters.cancellation ?? '',
    centre,
  ]);
}

export function loadCategoryOptions(
  db: D1Database,
  centre: string,
  filters: FacetFilters,
): Promise<string[]> {
  const today = madridToday();
  return categories.get(db, key(today, filters, centre), () =>
    listCategories(db, today, centre, filters),
  );
}

export function loadCentreOptions(
  db: D1Database,
  filters: FacetFilters,
): Promise<CentreListing[]> {
  const today = madridToday();
  return centres.get(db, key(today, filters), () =>
    listCentres(db, today, filters),
  );
}

/** Drops memoized read lookups for a database, e.g. after a test changes its data. */
export function clearReadCaches(db: D1Database): void {
  categories.clear(db);
  centres.clear(db);
  clearGeographyCache(db);
  clearCentreCaches(db);
}
