import { parseFilters } from '../courses/discovery';
import { startMonthOptions } from '../courses/start-month';
import {
  emptyGeography,
  reconcileGeography,
  type Geography,
} from '../locations/geography';
import {
  listCategories,
  listCentres,
  listCourses,
  type CentreOption,
} from './query';
import type { Catalog, CourseListing, DiscoveryFilters } from './types';

export interface DiscoveryPageData {
  geography: Geography;
  /** Set when stale geographic selections were dropped; replaces the URL query. */
  canonicalQuery?: string;
  courses: CourseListing[];
  categories: string[];
  centres: CentreOption[];
  startMonths: string[];
  filters: DiscoveryFilters;
  hasNext: boolean;
  total: number;
  error: 'invalid' | null;
}

const defaultFilters: DiscoveryFilters = {
  q: '',
  page: 1,
  maxPriceCents: null,
  category: '',
  centre: '',
};

function invalid(
  filters: DiscoveryFilters,
  geography: Geography,
): DiscoveryPageData {
  return {
    geography,
    courses: [],
    categories: [],
    centres: [],
    startMonths: [],
    filters,
    hasNext: false,
    total: 0,
    error: 'invalid',
  };
}

/**
 * Search results for a query string, computed from a catalog. This is the whole
 * discovery service: the browser runs it over the search index for each search.
 */
export function discover(
  catalog: Catalog,
  params: URLSearchParams,
  today: string,
): DiscoveryPageData {
  let parsed: DiscoveryFilters;
  try {
    parsed = parseFilters(params);
  } catch {
    return invalid(defaultFilters, emptyGeography);
  }
  let normalized;
  try {
    normalized = reconcileGeography(parsed, catalog.geography);
  } catch {
    return invalid(parsed, catalog.geography);
  }
  // A native form can submit a city outside the chosen region: drop the stale child
  // selection (and the page) and report the canonical query so the URL can follow.
  const canonical = new URLSearchParams(params);
  let changed = false;
  for (const key of ['country', 'region', 'city'] as const) {
    if ((parsed[key] ?? '') !== normalized[key]) {
      changed = true;
      if (normalized[key]) canonical.set(key, normalized[key]);
      else canonical.delete(key);
    }
  }
  if (changed) canonical.delete('page');
  const filters: DiscoveryFilters = {
    ...parsed,
    ...normalized,
    ...(changed ? { page: 1 } : {}),
  };
  return {
    filters,
    ...listCourses(catalog, filters, today),
    categories: listCategories(catalog, today, filters.centre, filters),
    centres: listCentres(catalog, today, filters),
    geography: catalog.geography,
    startMonths: startMonthOptions(today, filters.archive),
    error: null,
    ...(changed ? { canonicalQuery: canonical.toString() } : {}),
  };
}

export interface FilterOptions {
  centre: string;
  centres: CentreOption[];
  categories: string[];
}

/**
 * Centre and category choices for a location; an unavailable centre is cleared.
 * Throws on invalid input, like the former filter endpoint answered 400.
 */
export function filterOptions(
  catalog: Catalog,
  params: URLSearchParams,
  today: string,
): FilterOptions {
  const parsed = parseFilters(params);
  const filters = {
    ...parsed,
    ...reconcileGeography(parsed, catalog.geography),
  };
  const centres = listCentres(catalog, today, filters);
  const centre = centres.some((row) => row.id === filters.centre)
    ? filters.centre
    : '';
  return {
    centre,
    centres,
    categories: listCategories(catalog, today, centre, filters),
  };
}
