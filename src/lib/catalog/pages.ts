import { sources } from '../sources';
import { alertsAdvertised } from '../alerts/page';
import type { AlertOptions } from '../alerts/options';
import { defaultFilters, discover, type DiscoveryPageData } from './discovery';
import { buildDate, loadSnapshot } from './snapshot-file';
import {
  canonicalListing,
  catalogToday,
  filterCourses,
  listCategories,
  listLatestCourses,
} from './query';
import {
  buildSearchIndexes,
  type OfficialSource,
  type SearchIndex,
} from './search-index';
import type { Centre, CentreMapPoint, CourseListing, Snapshot } from './types';

// Build-time page data. Everything is computed from one snapshot at its own date, so
// all pages and the search index of a build agree with each other.

function context() {
  const snapshot = loadSnapshot();
  return { snapshot, today: catalogToday(snapshot, buildDate(snapshot)) };
}

/** Time zones for the browser's expired-edition check on prerendered cards. */
export function catalogTimeZones(): string[] {
  return loadSnapshot().timeZones;
}

export function loadHomepage(): { courses: CourseListing[] } {
  const { snapshot, today } = context();
  return { courses: listLatestCourses(snapshot.editions, today) };
}

/** The search page as it looks without filters; the browser takes over from there. */
export function loadSearchShell(): DiscoveryPageData {
  const { snapshot, today } = context();
  return discover(snapshot, new URLSearchParams(), today);
}

export function alertsEnabled(): boolean {
  return alertsAdvertised(process.env);
}

/** Live categories and all cities, as of this build, for the alert form. */
export function alertOptions(): AlertOptions {
  const { snapshot, today } = context();
  return {
    categories: listCategories(snapshot, today),
    cities: snapshot.geography.cities,
  };
}

export function officialSources(): OfficialSource[] {
  return sources.map((source) => ({
    institutionId: source.institution.id,
    institutionName: source.institution.name,
    country: source.institution.country,
    cityId: source.institution.cityId,
    listingUrl: source.listingUrl,
  }));
}

export function searchIndexes(): { live: SearchIndex; archive: SearchIndex } {
  const { snapshot, today } = context();
  return buildSearchIndexes(snapshot, officialSources(), today);
}

export interface CentrePage {
  centre: Centre;
  courses: CourseListing[];
}

/** Every centre with a profile and its live editions, in listing order. */
export function centrePagesFrom(
  snapshot: Snapshot,
  today: string,
): CentrePage[] {
  return snapshot.centres.map((centre) => ({
    centre,
    courses: filterCourses(
      snapshot,
      { ...defaultFilters, centre: centre.id },
      today,
    ).map(canonicalListing),
  }));
}

export function loadCentrePages(): CentrePage[] {
  const { snapshot, today } = context();
  return centrePagesFrom(snapshot, today);
}

export interface DirectoryData {
  centres: Centre[];
  cities: string[];
  mapCentres: CentreMapPoint[];
  mapHasMore: boolean;
}

export function loadDirectory(): DirectoryData {
  return directoryFrom(loadSnapshot());
}

export function directoryFrom(snapshot: Snapshot): DirectoryData {
  return {
    centres: snapshot.centres,
    cities: [...new Set(snapshot.centres.map((centre) => centre.city))].sort(
      (a, b) => a.localeCompare(b),
    ),
    ...snapshot.map,
  };
}

export interface CategoryPage {
  slug: string;
  category: string;
  courses: CourseListing[];
}

/**
 * One browsable page per topic with live editions, so the catalogue stays reachable
 * without JavaScript. Topic ids are the slugs.
 */
export function loadCategoryPages(): CategoryPage[] {
  const { snapshot, today } = context();
  return categoryPagesFrom(snapshot, today);
}

export function categoryPagesFrom(
  snapshot: Snapshot,
  today: string,
): CategoryPage[] {
  const { categories } = discover(snapshot, new URLSearchParams(), today);
  return categories.map((category) => ({
    slug: category,
    category,
    courses: filterCourses(
      snapshot,
      { ...defaultFilters, category },
      today,
    ).map(canonicalListing),
  }));
}
