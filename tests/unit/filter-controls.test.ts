import { describe, expect, it } from 'vitest';
import { matchesSearch } from '../../src/lib/courses/filter-controls';

describe('centre option search', () => {
  it('matches every typed word anywhere, ignoring case and accents', () => {
    const name = 'Espai de Persones Grans de Sant Genís dels Agudells';
    expect(matchesSearch(name, '')).toBe(true);
    expect(matchesSearch(name, '  ')).toBe(true);
    expect(matchesSearch(name, 'GENIS')).toBe(true);
    expect(matchesSearch(name, 'agudells sant')).toBe(true);
    expect(matchesSearch(name, 'gènís')).toBe(true);
    expect(matchesSearch(name, 'sant llacuna')).toBe(false);
  });
});
