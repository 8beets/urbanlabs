export interface GeographicFilters {
  country?: string;
  region?: string;
  city?: string;
}
export interface Country {
  code: string;
  name: string;
}
export interface Region {
  id: string;
  country_code: string;
  name: string;
}
export interface City {
  id: string;
  country_code: string;
  region_id: string;
  name: string;
}
export interface Geography {
  countries: Country[];
  regions: Region[];
  cities: City[];
}
export const emptyGeography: Geography = {
  countries: [],
  regions: [],
  cities: [],
};
const CATALOG_LIMIT = 1000;

// The catalog changes only with migrations, yet every page and filter request read
// all three tables. A short per-isolate memo avoids those repeated D1 row reads.
const GEOGRAPHY_TTL_MS = 5 * 60 * 1000;
const geographyMemo = new WeakMap<
  D1Database,
  { expires: number; value: Promise<Geography> }
>();

export function clearGeographyCache(db: D1Database): void {
  geographyMemo.delete(db);
}

export function loadGeography(db: D1Database): Promise<Geography> {
  const memo = geographyMemo.get(db);
  if (memo && memo.expires > Date.now()) return memo.value;
  const value = queryGeography(db);
  geographyMemo.set(db, { expires: Date.now() + GEOGRAPHY_TTL_MS, value });
  // Failures must not stay cached.
  value.catch(() => {
    if (geographyMemo.get(db)?.value === value) geographyMemo.delete(db);
  });
  return value;
}

async function queryGeography(db: D1Database): Promise<Geography> {
  const [countries, regions, cities] = await Promise.all([
    db
      .prepare('SELECT code,name FROM countries ORDER BY name,code LIMIT ?')
      .bind(CATALOG_LIMIT + 1)
      .all<Country>(),
    db
      .prepare(
        'SELECT id,country_code,name FROM regions ORDER BY name,id LIMIT ?',
      )
      .bind(CATALOG_LIMIT + 1)
      .all<Region>(),
    db
      .prepare(
        'SELECT id,country_code,region_id,name FROM cities ORDER BY name,id LIMIT ?',
      )
      .bind(CATALOG_LIMIT + 1)
      .all<City>(),
  ]);
  if (
    [countries.results, regions.results, cities.results].some(
      (rows) => rows.length > CATALOG_LIMIT,
    )
  )
    throw new Error('Geography catalog exceeds bounded lookup size');
  return {
    countries: countries.results,
    regions: regions.results,
    cities: cities.results,
  };
}

export function parseGeography(
  params: URLSearchParams,
): Required<GeographicFilters> {
  const country = params.get('country') || 'ES';
  const region = params.get('region') ?? '';
  const city = params.get('city') ?? '';
  if (country && !/^[A-Z]{2}$/.test(country))
    throw new Error('Invalid country');
  for (const id of [region, city])
    if (id && !/^[a-z0-9-]{1,100}$/.test(id))
      throw new Error('Invalid geographic identifier');
  return { country, region, city };
}

export function reconcileGeography(
  filters: GeographicFilters,
  catalog: Geography,
): Required<GeographicFilters> {
  const country = filters.country ?? '';
  let region = filters.region ?? '';
  let city = filters.city ?? '';
  const selectedRegion = catalog.regions.find((row) => row.id === region);
  const selectedCity = catalog.cities.find((row) => row.id === city);
  if (country && !catalog.countries.some((row) => row.code === country))
    throw new Error('Unknown country');
  if (region && !selectedRegion) throw new Error('Unknown region');
  if (city && !selectedCity) throw new Error('Unknown city');
  // Parent selections take priority when a native form submits stale child selections.
  if (country && selectedRegion && selectedRegion.country_code !== country) {
    region = '';
    city = '';
  }
  if (
    city &&
    selectedCity &&
    ((country && selectedCity.country_code !== country) ||
      (region && selectedCity.region_id !== region))
  )
    city = '';
  return { country, region, city };
}

export function geographicCondition(
  filters: GeographicFilters,
  institutionId = 'i.id',
) {
  const clauses: string[] = [];
  const values: string[] = [];
  if (filters.country) {
    clauses.push('il.country_code=?');
    values.push(filters.country);
  }
  if (filters.region) {
    clauses.push('lc.region_id=?');
    values.push(filters.region);
  }
  if (filters.city) {
    clauses.push('il.city_id=?');
    values.push(filters.city);
  }
  return {
    sql: clauses.length
      ? `EXISTS (SELECT 1 FROM institution_locations il JOIN cities lc ON lc.id=il.city_id WHERE il.institution_id=${institutionId} AND ${clauses.join(' AND ')})`
      : '',
    values,
  };
}
