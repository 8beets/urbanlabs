import {
  listInstitutions,
  CENTRES_PAGE_SIZE,
  listMapCentres,
  type CentreMapPoint,
  findInstitution,
  type Centre,
} from '../db/institutions';
import { liveCutoffDate } from '../db/clock';
import { listCourses, type CourseListing } from '../db/courses';
import { parsePage } from '../pagination';
import { TtlMemo } from '../cache/ttl-memo';
import { centreCities, filterCentres } from './directory-filter';

// Centre data changes only with reviewed profile syncs, yet each directory page read
// every profile for the map. The map is shared by all pages; listings are per page.
const CENTRE_TTL_MS = 5 * 60 * 1000;
const mapMemo = new TtlMemo<Awaited<ReturnType<typeof listMapCentres>>>(
  CENTRE_TTL_MS,
  1,
);
const directoryMemo = new TtlMemo<Centre[]>(CENTRE_TTL_MS, 1);

export function clearCentreCaches(db: D1Database): void {
  mapMemo.clear(db);
  directoryMemo.clear(db);
}

export type CentrePageError = 'invalid' | 'unavailable' | 'notFound' | null;
export interface DirectoryPageData {
  mapCentres: CentreMapPoint[];
  mapHasMore: boolean;
  centres: Centre[];
  cities: string[];
  q: string;
  city: string;
  page: number;
  hasNext: boolean;
  error: CentrePageError;
  status: number;
}
export interface CentrePageData {
  centre: Centre | null;
  courses: CourseListing[];
  page: number;
  hasNext: boolean;
  error: CentrePageError;
  status: number;
}

export async function loadDirectoryPage(
  db: D1Database,
  params: URLSearchParams,
): Promise<DirectoryPageData> {
  let page: number;
  const q = (params.get('q') ?? '').trim();
  const city = params.get('city') ?? '';
  try {
    if (q.length > 100 || city.length > 100) throw new Error('Invalid filter');
    page = parsePage(params);
  } catch {
    return {
      centres: [],
      cities: [],
      q: '',
      city: '',
      mapCentres: [],
      mapHasMore: false,
      page: 1,
      hasNext: false,
      error: 'invalid',
      status: 400,
    };
  }
  try {
    const [all, locations] = await Promise.all([
      directoryMemo.get(db, 'all', () => listInstitutions(db)),
      mapMemo.get(db, 'map', () => listMapCentres(db)),
    ]);
    const matches = filterCentres(all, { q, city });
    const start = (page - 1) * CENTRES_PAGE_SIZE;
    return {
      ...locations,
      centres: matches.slice(start, start + CENTRES_PAGE_SIZE),
      hasNext: matches.length > start + CENTRES_PAGE_SIZE,
      cities: centreCities(all),
      q,
      city,
      page,
      error: null,
      status: 200,
    };
  } catch {
    console.error(JSON.stringify({ event: 'centre_directory_unavailable' }));
    return {
      centres: [],
      cities: [],
      q,
      city,
      mapCentres: [],
      mapHasMore: false,
      page,
      hasNext: false,
      error: 'unavailable',
      status: 503,
    };
  }
}

export async function loadCentrePage(
  db: D1Database,
  slug: string,
  params: URLSearchParams,
): Promise<CentrePageData> {
  const empty = { centre: null, courses: [], page: 1, hasNext: false };
  if (!/^[a-z0-9-]{1,100}$/.test(slug))
    return { ...empty, error: 'notFound', status: 404 };
  let page: number;
  try {
    page = parsePage(params);
  } catch {
    return { ...empty, error: 'invalid', status: 400 };
  }
  try {
    const centre = await findInstitution(db, slug);
    if (!centre) return { ...empty, error: 'notFound', status: 404 };
    const listing = await listCourses(
      db,
      {
        q: '',
        category: '',
        maxPriceCents: null,
        centre: centre.id,
        page,
      },
      await liveCutoffDate(db),
    );
    return { ...listing, centre, page, error: null, status: 200 };
  } catch {
    console.error(JSON.stringify({ event: 'centre_page_unavailable' }));
    return { ...empty, error: 'unavailable', status: 503 };
  }
}
