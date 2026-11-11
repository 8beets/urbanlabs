import { describe, expect, it } from 'vitest';
import { centreMatches } from '../../src/lib/institutions/directory-filter';

const centres = [
  ['Centre Cívic Fort Pienc Carrer d’Ausiàs Marc', 'Barcelona'],
  ['Centre Cultural Alicante Carrer X', 'Alicante'],
  ['Casa Elizalde Carrer X', 'Barcelona'],
] as const;
const matching = (filter: { q: string; city: string }) =>
  centres.filter(([text, city]) => centreMatches(text, city, filter));

describe('directory filter', () => {
  it('ignores accents and case and requires every word', () => {
    expect(matching({ q: 'CIVIC pienc', city: '' })).toHaveLength(1);
    expect(matching({ q: 'ausias', city: '' })).toHaveLength(1);
    expect(matching({ q: 'centre zzz', city: '' })).toHaveLength(0);
  });
  it('filters by city', () => {
    expect(matching({ q: '', city: 'Alicante' })).toHaveLength(1);
    expect(matching({ q: '', city: '' })).toHaveLength(3);
  });
});
