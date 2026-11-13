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
  isLive,
  listLatestCourses,
} from './query';
import {
  buildSearchIndexes,
  type OfficialSource,
  type SearchIndex,
} from './search-index';
import type { City } from '../locations/geography';
import type {
  SnapshotCentre,
  CentreMapPoint,
  CourseListing,
  Snapshot,
} from './types';

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

export interface CityPage {
  city: City;
  /** Live editions in the city as of the build. */
  courses: number;
}

/** Cities with at least one located centre; each gets its own section of the site. */
export function citiesFrom(snapshot: Snapshot, today: string): CityPage[] {
  const located = new Set(snapshot.locations.map((row) => row.city_id));
  return snapshot.geography.cities
    .filter((city) => located.has(city.id))
    .map((city) => ({
      city,
      courses: snapshot.editions.filter(
        (edition) => edition.city_id === city.id && isLive(edition, today),
      ).length,
    }));
}

export function loadCities(): CityPage[] {
  const { snapshot, today } = context();
  return citiesFrom(snapshot, today);
}

/** Centre id → city id, for centres with a reviewed location. */
function centreCities(snapshot: Snapshot): Map<string, string> {
  const centres = new Set(snapshot.centres.map((centre) => centre.id));
  return new Map(
    snapshot.locations
      .filter((row) => centres.has(row.institution_id))
      .map((row) => [row.institution_id, row.city_id]),
  );
}

const cityParams = (city: string) => new URLSearchParams({ city });

/** A city's search page as it looks without filters; the browser takes over from there. */
export function loadSearchShell(city: string): DiscoveryPageData {
  const { snapshot, today } = context();
  return discover(snapshot, cityParams(city), today);
}

export function alertsEnabled(): boolean {
  return alertsAdvertised(process.env);
}

/**
 * Live categories and the cities with their own section, as of this build, for the
 * alert form. Every alert belongs to one of these cities.
 */
export function alertOptions(): AlertOptions {
  const { snapshot, today } = context();
  return {
    categories: listCategories(snapshot, today),
    cities: citiesFrom(snapshot, today).map(({ city }) => city),
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

export function searchIndexes(city: string): {
  live: SearchIndex;
  archive: SearchIndex;
} {
  const { snapshot, today } = context();
  return buildSearchIndexes(snapshot, officialSources(), today, city);
}

export interface CentrePage {
  centre: SnapshotCentre;
  city: string;
  courses: CourseListing[];
}

/** Every centre with a profile and a city, and its live editions, in listing order. */
export function centrePagesFrom(
  snapshot: Snapshot,
  today: string,
): CentrePage[] {
  const cities = centreCities(snapshot);
  return snapshot.centres.flatMap((centre) => {
    const city = cities.get(centre.id);
    return city
      ? [
          {
            centre,
            city,
            courses: filterCourses(
              snapshot,
              { ...defaultFilters, centre: centre.id },
              today,
            ).map(canonicalListing),
          },
        ]
      : [];
  });
}

export function loadCentrePages(): CentrePage[] {
  const { snapshot, today } = context();
  return centrePagesFrom(snapshot, today);
}

export interface DirectoryData {
  centres: SnapshotCentre[];
  mapCentres: CentreMapPoint[];
  mapHasMore: boolean;
}

export function loadDirectory(city: string): DirectoryData {
  return directoryFrom(loadSnapshot(), city);
}

/** One city's centres and the mapped ones among them. */
export function directoryFrom(snapshot: Snapshot, city: string): DirectoryData {
  const cities = centreCities(snapshot);
  const inCity = (id: string) => cities.get(id) === city;
  return {
    centres: snapshot.centres.filter((centre) => inCity(centre.id)),
    mapCentres: snapshot.map.mapCentres.filter((centre) => inCity(centre.id)),
    mapHasMore: snapshot.map.mapHasMore,
  };
}

export interface CategoryPage {
  city: string;
  slug: string;
  category: string;
  courses: CourseListing[];
}

/**
 * One browsable page per city and topic with live editions, so the catalogue stays
 * reachable without JavaScript. Topic ids are the slugs.
 */
export function loadCategoryPages(): CategoryPage[] {
  const { snapshot, today } = context();
  return categoryPagesFrom(snapshot, today);
}

export function categoryPagesFrom(
  snapshot: Snapshot,
  today: string,
): CategoryPage[] {
  return citiesFrom(snapshot, today).flatMap(({ city }) => {
    const { categories } = discover(snapshot, cityParams(city.id), today);
    return categories.map((category) => ({
      city: city.id,
      slug: category,
      category,
      courses: filterCourses(
        snapshot,
        { ...defaultFilters, city: city.id, category },
        today,
      ).map(canonicalListing),
    }));
  });
}
