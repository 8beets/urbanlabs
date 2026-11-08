import { describe, expect, it } from 'vitest';
import { titleSearchMatch } from '../../src/lib/courses/title-search';

describe('title search expression', () => {
  it('requires every word as a quoted prefix', () => {
    expect(titleSearchMatch('conversa anglès')).toBe('"conversa"* "anglès"*');
  });

  it('keeps FTS5 syntax typed by users inert', () => {
    expect(titleSearchMatch('yoga OR "pilates" NOT col*')).toBe(
      '"yoga"* "OR"* """pilates"""* "NOT"* "col*"*',
    );
  });

  it('normalizes composed and decomposed input to the same text', () => {
    expect(titleSearchMatch('anglès')).toBe(titleSearchMatch('anglès'));
  });

  it.each(['', '   ', '--', '"" ""', '*'])(
    'returns null when %j has no letters or digits',
    (query) => {
      expect(titleSearchMatch(query)).toBeNull();
    },
  );
});
