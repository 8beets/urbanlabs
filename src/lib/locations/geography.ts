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
