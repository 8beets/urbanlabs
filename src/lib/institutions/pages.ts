import {
  listInstitutions,
  listMapCentres,
  type CentreMapPoint,
  findInstitution,
  type Centre,
} from '../db/institutions';
import { liveCutoffDate } from '../db/clock';
import { listCourses, type CourseListing } from '../db/courses';
import { parsePage } from '../pagination';
import { TtlMemo } from '../cache/ttl-memo';

// Centre data changes only with reviewed profile syncs, yet each directory page read
// every profile for the map. The map is shared by all pages; listings are per page.
const CENTRE_TTL_MS = 5 * 60 * 1000;
const mapMemo = new TtlMemo<Awaited<ReturnType<typeof listMapCentres>>>(
  CENTRE_TTL_MS,
  1,
);
const directoryMemo = new TtlMemo<Awaited<ReturnType<typeof listInstitutions>>>(
  CENTRE_TTL_MS,
  50,
);

export function clearCentreCaches(db: D1Database): void {
  mapMemo.clear(db);
  directoryMemo.clear(db);
}

export type CentrePageError = 'invalid' | 'unavailable' | 'notFound' | null;
export interface DirectoryPageData {
  mapCentres: CentreMapPoint[];
  mapHasMore: boolean;
  centres: Centre[];
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
  try {
    page = parsePage(params);
  } catch {
    return {
      centres: [],
      mapCentres: [],
      mapHasMore: false,
      page: 1,
      hasNext: false,
      error: 'invalid',
      status: 400,
    };
  }
  try {
    const [listing, locations] = await Promise.all([
      directoryMemo.get(db, String(page), () => listInstitutions(db, page)),
      mapMemo.get(db, 'map', () => listMapCentres(db)),
    ]);
    return {
      ...listing,
      ...locations,
      page,
      error: null,
      status: 200,
    };
  } catch {
    console.error(JSON.stringify({ event: 'centre_directory_unavailable' }));
    return {
      centres: [],
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
