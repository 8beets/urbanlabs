import { describe, expect, it } from 'vitest';
import { centreMatches } from '../../src/lib/institutions/directory-filter';

const centres = [
  'Centre Cívic Fort Pienc Carrer d’Ausiàs Marc',
  'Casa Elizalde Carrer X',
];
const matching = (q: string) =>
  centres.filter((text) => centreMatches(text, q));

describe('directory filter', () => {
  it('ignores accents and case and requires every word', () => {
    expect(matching('CIVIC pienc')).toHaveLength(1);
    expect(matching('ausias')).toHaveLength(1);
    expect(matching('centre zzz')).toHaveLength(0);
    expect(matching('')).toHaveLength(2);
  });
});
