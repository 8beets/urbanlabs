import {
  parseGeography,
  loadGeography,
  reconcileGeography,
  type Geography,
} from '../locations/geography';
import {
  listCourses,
  listCategories,
  listCentres,
  type DiscoveryFilters,
} from '../db/courses';
import { canonicalCategory } from './categories';
import { parsePage } from '../pagination';
import { isStartMonth } from './start-month';

export function parseFilters(params: URLSearchParams): DiscoveryFilters {
  const page = parsePage(params);
  const q = (params.get('q') ?? '').trim();
  const category = (params.get('category') ?? '').trim();
  const centre = params.get('centre') ?? '';
  const cancellation = params.get('cancellation') ?? '';
  if (cancellation !== '' && cancellation !== 'hide' && cancellation !== 'only')
    throw new Error('Invalid cancellation filter');
  if (centre && !/^[a-z0-9-]{1,100}$/.test(centre))
    throw new Error('Invalid centre');
  if (
    category.length > 200 ||
    [...category].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    throw new Error('Invalid category');
  // D1 LIKE patterns have a 50-byte limit, including wildcard delimiters.
  if (new TextEncoder().encode(q).length > 40)
    throw new Error('Search too long');
  const maxPrice = params.get('maxPrice') ?? '';
  if (maxPrice && !/^\d{1,4}(\.\d{1,2})?$/.test(maxPrice))
    throw new Error('Invalid price');
  const startMonth = params.get('start') ?? '';
  if (startMonth && !isStartMonth(startMonth))
    throw new Error('Invalid start month');
  return {
    ...parseGeography(params),
    q,
    category: canonicalCategory(category),
    centre,
    cancellation,
    page,
    startMonth,
    maxPriceCents: maxPrice ? Math.round(Number(maxPrice) * 100) : null,
  };
}

export async function discoverCourses(
  db: D1Database,
  params: URLSearchParams,
  geography?: Geography,
) {
  const catalog = geography ?? (await loadGeography(db));
  const parsed = parseFilters(params);
  const filters = { ...parsed, ...reconcileGeography(parsed, catalog) };
  const [listing, categories, centres] = await Promise.all([
    listCourses(db, filters),
    listCategories(db, undefined, filters.centre, filters),
    listCentres(db, undefined, filters),
  ]);
  return { filters, ...listing, categories, centres, geography: catalog };
}
