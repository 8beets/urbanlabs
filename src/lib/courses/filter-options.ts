import { loadCategoryOptions, loadCentreOptions } from './facets';
import {
  loadGeography,
  reconcileGeography,
  type Geography,
} from '../locations/geography';
import { parseFilters } from './discovery';

export interface FilterOption {
  value: string;
  label: string;
}
export interface FilterOptions {
  centre: string;
  centres: FilterOption[];
  categories: FilterOption[];
}

// This lookup never loads course records. An upstream change clears unavailable centres.
export async function loadFilterOptions(
  db: D1Database,
  params: URLSearchParams,
  catalog?: Geography,
) {
  const parsed = parseFilters(params);
  const geography = catalog ?? (await loadGeography(db));
  const filters = { ...parsed, ...reconcileGeography(parsed, geography) };
  const centres = await loadCentreOptions(db, filters);
  const centre = centres.some((row) => row.id === filters.centre)
    ? filters.centre
    : '';
  const categories = await loadCategoryOptions(db, centre, filters);
  return { centre, centres, categories };
}
