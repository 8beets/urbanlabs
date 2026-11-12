import { describe, expect, it } from 'vitest';
import {
  foldText,
  parseTitleQuery,
  titleMatches,
  tokenize,
} from '../../src/lib/catalog/title-match';

// Mirrors the FTS5 `unicode61 remove_diacritics 2` prefix search of migration 0008.
const matches = (title: string, query: string) => {
  const phrases = parseTitleQuery(query);
  return phrases !== null && titleMatches(title, phrases);
};

describe('static title search', () => {
  it('folds case, accents and Unicode composition', () => {
    expect(foldText('ANGLÈS')).toBe('angles');
    expect(foldText('Anglès'.normalize('NFD'))).toBe('angles');
    expect(matches('Fotografía digital', 'fotografia')).toBe(true);
    expect(matches('FOTOGRAFIA'.normalize('NFD'), 'fotografía')).toBe(true);
  });
  it('matches every typed word as the start of a title word', () => {
    expect(matches('Conversa en anglès', 'conversa anglès')).toBe(true);
    expect(matches('Conversa en anglès', 'conv ang')).toBe(true);
    expect(matches('Conversa en anglès', 'conversa francès')).toBe(false);
    // Mid-word fragments do not match, as with the FTS prefix index.
    expect(matches('Fotografia', 'graf')).toBe(false);
  });
  it('treats punctuation inside a word as a phrase of tokens', () => {
    expect(tokenize("L'art del còmic")).toEqual(['l', 'art', 'del', 'comic']);
    expect(matches("L'art del còmic", "l'ar")).toBe(true);
    expect(matches("L'art del còmic", "l'comic")).toBe(false);
  });
  it('ignores query operators and returns null when nothing can match', () => {
    expect(matches('Yoga i pilates', 'yoga OR "pilates"')).toBe(false);
    expect(matches('Yoga or pilates', 'yoga OR "pilates"')).toBe(true);
    for (const query of ['', '   ', '***', '" -'])
      expect(parseTitleQuery(query)).toBeNull();
  });
});
