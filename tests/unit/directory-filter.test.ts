import { describe, expect, it } from 'vitest';
import {
  centreCities,
  filterCentres,
} from '../../src/lib/institutions/directory-filter';
import type { Centre } from '../../src/lib/db/institutions';

const centre = (name: string, city: string, address = 'Carrer X'): Centre =>
  ({ name, city, address }) as Centre;
const all = [
  centre('Centre Cívic Fort Pienc', 'Barcelona', 'Carrer d’Ausiàs Marc'),
  centre('Centre Cultural Alicante', 'Alicante'),
  centre('Casa Elizalde', 'Barcelona'),
];

describe('directory filter', () => {
  it('ignores accents and case and requires every word', () => {
    expect(filterCentres(all, { q: 'CIVIC pienc', city: '' })).toHaveLength(1);
    expect(filterCentres(all, { q: 'ausias', city: '' })).toHaveLength(1);
    expect(filterCentres(all, { q: 'centre zzz', city: '' })).toHaveLength(0);
  });
  it('filters by city and lists cities once, sorted', () => {
    expect(filterCentres(all, { q: '', city: 'Alicante' })).toHaveLength(1);
    expect(filterCentres(all, { q: '', city: '' })).toHaveLength(3);
    expect(centreCities(all)).toEqual(['Alicante', 'Barcelona']);
  });
});
