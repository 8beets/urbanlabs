import { describe, expect, it } from 'vitest';
import {
  parseGeography,
  reconcileGeography,
  type Geography,
} from '../../src/lib/locations/geography';
import { cityLabel, coveredCities } from '../../src/i18n/geography';
import { cityRows, geography } from '../../src/lib/locations/registry';
import { centres } from '../../src/lib/centres/registry';
const catalog: Geography = {
  countries: [
    { code: 'ES', name: 'España' },
    { code: 'FR', name: 'France' },
  ],
  regions: [
    { id: 'catalunya', country_code: 'ES', name: 'Catalunya' },
    { id: 'asturias', country_code: 'ES', name: 'Asturias' },
    { id: 'occitanie', country_code: 'FR', name: 'Occitanie' },
  ],
  cities: [
    {
      id: 'barcelona',
      country_code: 'ES',
      region_id: 'catalunya',
      name: 'Barcelona',
    },
    { id: 'oviedo', country_code: 'ES', region_id: 'asturias', name: 'Oviedo' },
    {
      id: 'toulouse',
      country_code: 'FR',
      region_id: 'occitanie',
      name: 'Toulouse',
    },
  ],
};
describe('geographic filters', () => {
  it('defaults to Spain when country is omitted or empty', () => {
    for (const query of ['', 'country='])
      expect(parseGeography(new URLSearchParams(query))).toEqual({
        country: 'ES',
        region: '',
        city: '',
      });
  });
  it('rejects malformed and unknown identifiers', () => {
    for (const query of ['country=spain', 'city=a%27', 'region=CATALUNYA'])
      expect(() => parseGeography(new URLSearchParams(query))).toThrow();
    for (const query of ['country=ZZ', 'city=missing', 'region=missing'])
      expect(() =>
        reconcileGeography(parseGeography(new URLSearchParams(query)), catalog),
      ).toThrow();
  });
  it('keeps compatible children and removes stale children when a parent changes', () => {
    expect(
      reconcileGeography(
        { country: 'ES', region: 'catalunya', city: 'barcelona' },
        catalog,
      ),
    ).toEqual({ country: 'ES', region: 'catalunya', city: 'barcelona' });
    expect(
      reconcileGeography(
        { country: 'ES', region: 'asturias', city: 'barcelona' },
        catalog,
      ),
    ).toEqual({ country: 'ES', region: 'asturias', city: '' });
    expect(
      reconcileGeography(
        { country: 'FR', region: 'catalunya', city: 'barcelona' },
        catalog,
      ),
    ).toEqual({ country: 'FR', region: '', city: '' });
  });
  it('localizes Alicante and retains other city names', () => {
    const alicante = { id: 'alicante', name: 'Alicante' };
    expect(cityLabel(alicante, 'es')).toBe('Alicante');
    expect(cityLabel(alicante, 'ca')).toBe('Alacant');
    expect(cityLabel(catalog.cities[0]!, 'ca')).toBe('Barcelona');
  });
  it('names covered cities per locale from the geography data', () => {
    expect(cityLabel({ id: 'zaragoza', name: 'Zaragoza' }, 'ca')).toBe(
      'Saragossa',
    );
    expect(cityLabel({ id: 'oviedo', name: 'Oviedo' }, 'ca')).toBe('Oviedo');
    expect(coveredCities('es')).toBe('Barcelona y Zaragoza');
    expect(coveredCities('ca')).toBe('Barcelona i Saragossa');
  });
  it('lists every centre city with its region and country', () => {
    for (const centre of centres)
      expect(cityRows(centre.cityId)?.region.country).toBe(centre.country);
    expect(cityRows('missing')).toBeNull();
    expect(geography.cities.map((city) => city.id)).toContain('zaragoza');
  });
});
