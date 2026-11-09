import {
  loadGeography,
  reconcileGeography,
  emptyGeography,
  type Geography,
} from '../locations/geography';
import { liveCutoffDate } from '../db/clock';
import { listLatestCourses } from '../db/courses';
import { discoverCourses, parseFilters } from './discovery';
import type {
  CourseListing,
  DiscoveryFilters,
  CentreListing,
} from '../db/courses';

export interface DiscoveryPageData {
  geography: Geography;
  canonicalQuery?: string;
  courses: CourseListing[];
  categories: string[];
  centres: CentreListing[];
  startMonths: string[];
  filters: DiscoveryFilters;
  hasNext: boolean;
  error: 'invalid' | 'unavailable' | null;
  status: number;
}

export async function loadDiscoveryPage(
  db: D1Database,
  params: URLSearchParams,
): Promise<DiscoveryPageData> {
  let filters: DiscoveryFilters;
  try {
    filters = parseFilters(params);
  } catch {
    return {
      geography: emptyGeography,
      courses: [],
      categories: [],
      centres: [],
      startMonths: [],
      filters: {
        q: '',
        page: 1,
        maxPriceCents: null,
        category: '',
        centre: '',
      },
      hasNext: false,
      error: 'invalid',
      status: 400,
    };
  }
  try {
    const geography = await loadGeography(db);
    let normalized;
    try {
      normalized = reconcileGeography(filters, geography);
    } catch {
      return {
        courses: [],
        categories: [],
        centres: [],
        startMonths: [],
        filters,
        geography,
        error: 'invalid',
        status: 400,
        hasNext: false,
      };
    }
    const canonical = new URLSearchParams(params);
    let changed = false;
    for (const key of ['country', 'region', 'city'] as const) {
      if ((filters[key] ?? '') !== normalized[key]) {
        changed = true;
        if (normalized[key]) canonical.set(key, normalized[key]);
        else canonical.delete(key);
      }
    }
    if (changed) canonical.delete('page');
    const data = await discoverCourses(db, canonical, geography);
    return {
      ...data,
      error: null,
      status: 200,
      ...(changed ? { canonicalQuery: canonical.toString() } : {}),
    };
  } catch {
    console.error(JSON.stringify({ event: 'discovery_unavailable' }));
    return {
      geography: emptyGeography,
      courses: [],
      categories: [],
      centres: [],
      startMonths: [],
      filters,
      hasNext: false,
      error: 'unavailable',
      status: 503,
    };
  }
}

export interface HomepagePageData {
  courses: CourseListing[];
  error: 'unavailable' | null;
  status: number;
}

export async function loadHomepage(db: D1Database): Promise<HomepagePageData> {
  try {
    return {
      courses: await listLatestCourses(db, await liveCutoffDate(db)),
      error: null,
      status: 200,
    };
  } catch {
    console.error(JSON.stringify({ event: 'latest_courses_unavailable' }));
    return { courses: [], error: 'unavailable', status: 503 };
  }
}
