import { canonicalCategory, sourceCategories } from '../courses/categories';
import { monthRange } from '../courses/start-month';
import { earliestLocalDate } from '../time/dates';
import { parseTitleQuery, titleMatches } from './title-match';
import type {
  Catalog,
  CourseListing,
  DiscoveryFilters,
  GeographicFilters,
  InstitutionLocation,
  SnapshotEdition,
} from './types';

// Pure equivalents of the former D1 discovery queries. They run at build time over
// the snapshot and in the browser over the search index, so both always agree.

export const PAGE_SIZE = 12;
export const LATEST_COURSES_LIMIT = 20;
const OPTIONS_LIMIT = 100;

/** Unknown end dates mean "not known to have ended" (see migration 0009). */
export function liveUntil(edition: Pick<CourseListing, 'end_date'>): string {
  return edition.end_date ?? '9999-12-31';
}

/** The catalogue's current date: the earliest local date across its time zones. */
export function catalogToday(
  catalog: Pick<Catalog, 'timeZones'>,
  now: Date = new Date(),
): string {
  return earliestLocalDate(catalog.timeZones, now);
}

export function isLive(edition: CourseListing, today: string): boolean {
  return liveUntil(edition) >= today;
}

/** SQLite's default BINARY collation, so orderings match the former SQL exactly. */
function binary(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function canonicalListing<T extends CourseListing>(course: T): T {
  return {
    ...course,
    category:
      course.category === null ? null : canonicalCategory(course.category),
  };
}

type LocationIndex = Map<string, InstitutionLocation>;
const locationIndexes = new WeakMap<object, LocationIndex>();
function locationsOf(catalog: Pick<Catalog, 'locations'>): LocationIndex {
  let index = locationIndexes.get(catalog.locations);
  if (!index) {
    index = new Map(catalog.locations.map((row) => [row.institution_id, row]));
    locationIndexes.set(catalog.locations, index);
  }
  return index;
}

function inGeography(
  institutionId: string,
  filters: GeographicFilters,
  locations: LocationIndex,
): boolean {
  if (!filters.country && !filters.region && !filters.city) return true;
  // Institutions without a reviewed location never match a geographic filter.
  const location = locations.get(institutionId);
  return (
    location !== undefined &&
    (!filters.country || location.country_code === filters.country) &&
    (!filters.region || location.region_id === filters.region) &&
    (!filters.city || location.city_id === filters.city)
  );
}

function matchesState(
  edition: CourseListing,
  today: string,
  filters: Pick<DiscoveryFilters, 'cancellation' | 'archive'>,
): boolean {
  if (filters.cancellation === 'hide' && edition.is_cancelled !== 0)
    return false;
  if (filters.cancellation === 'only' && edition.is_cancelled !== 1)
    return false;
  // Expired editions remain published only in the archive.
  return filters.archive ? !isLive(edition, today) : isLive(edition, today);
}

function compareLive(a: CourseListing, b: CourseListing): number {
  return (
    a.is_cancelled - b.is_cancelled ||
    a.is_sold_out - b.is_sold_out ||
    Number(a.start_date === null) - Number(b.start_date === null) ||
    binary(a.start_date ?? '', b.start_date ?? '') ||
    binary(a.id, b.id)
  );
}

function compareArchive(a: CourseListing, b: CourseListing): number {
  return binary(liveUntil(b), liveUntil(a)) || binary(a.id, b.id);
}

/** Every edition matching the filters, in listing order (not paginated). */
export function filterCourses(
  catalog: Catalog,
  filters: DiscoveryFilters,
  today: string,
): CourseListing[] {
  const locations = locationsOf(catalog);
  const categories = filters.category
    ? new Set(sourceCategories(filters.category))
    : null;
  const phrases = filters.q ? parseTitleQuery(filters.q) : null;
  // A query without letters or digits matches nothing, as with the FTS index.
  if (filters.q && phrases === null) return [];
  const month = filters.startMonth ? monthRange(filters.startMonth) : null;
  return catalog.editions
    .filter(
      (edition) =>
        matchesState(edition, today, filters) &&
        inGeography(edition.institution_id, filters, locations) &&
        (!categories ||
          (edition.category !== null && categories.has(edition.category))) &&
        (!filters.centre || edition.institution_id === filters.centre) &&
        (!phrases || titleMatches(edition.title, phrases)) &&
        (filters.maxPriceCents === null ||
          (edition.price_cents !== null &&
            edition.price_cents <= filters.maxPriceCents)) &&
        (filters.places !== 'available' || edition.is_sold_out === 0) &&
        // Editions without a start date never match: unknown dates are not inferred.
        (!month ||
          (edition.start_date !== null &&
            edition.start_date >= month[0] &&
            edition.start_date < month[1])),
    )
    .sort(filters.archive ? compareArchive : compareLive);
}

export function listCourses(
  catalog: Catalog,
  filters: DiscoveryFilters,
  today: string,
): { courses: CourseListing[]; hasNext: boolean; total: number } {
  const matches = filterCourses(catalog, filters, today);
  const start = (filters.page - 1) * PAGE_SIZE;
  return {
    courses: matches.slice(start, start + PAGE_SIZE).map(canonicalListing),
    hasNext: matches.length > start + PAGE_SIZE,
    total: matches.length,
  };
}

type FacetFilters = GeographicFilters &
  Pick<DiscoveryFilters, 'cancellation' | 'archive'>;

/** Canonical category groups offered for the current location (and centre). */
export function listCategories(
  catalog: Catalog,
  today: string,
  centre = '',
  filters: FacetFilters = {},
): string[] {
  const locations = locationsOf(catalog);
  const raw = new Set<string>();
  for (const edition of catalog.editions)
    if (
      edition.category &&
      matchesState(edition, today, filters) &&
      (!centre || edition.institution_id === centre) &&
      inGeography(edition.institution_id, filters, locations)
    )
      raw.add(edition.category);
  const bounded = [...raw].sort(binary).slice(0, OPTIONS_LIMIT);
  return [...new Set(bounded.map(canonicalCategory))].sort();
}

export interface CentreOption {
  id: string;
  name: string;
}

/** Centres with matching editions in the current location. */
export function listCentres(
  catalog: Catalog,
  today: string,
  filters: FacetFilters = {},
): CentreOption[] {
  const locations = locationsOf(catalog);
  const centres = new Map<string, string>();
  for (const edition of catalog.editions)
    if (
      matchesState(edition, today, filters) &&
      inGeography(edition.institution_id, filters, locations)
    )
      centres.set(edition.institution_id, edition.institution);
  return [...centres]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => binary(a.name, b.name) || binary(a.id, b.id))
    .slice(0, OPTIONS_LIMIT);
}

/** The newest live, non-cancelled additions by first-seen time. */
export function listLatestCourses(
  editions: SnapshotEdition[],
  today: string,
): CourseListing[] {
  return editions
    .filter((edition) => edition.is_cancelled === 0 && isLive(edition, today))
    .sort(
      (a, b) =>
        binary(b.first_seen_at, a.first_seen_at) ||
        binary(a.source_id, b.source_id) ||
        binary(a.external_id, b.external_id),
    )
    .slice(0, LATEST_COURSES_LIMIT)
    .map(canonicalListing);
}
