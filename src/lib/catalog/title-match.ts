// Mirrors the FTS5 title index of migration 0008 (`unicode61 remove_diacritics 2`)
// with a prefix query per typed word, so the static search matches exactly what the
// database search matched: case, accents and Unicode composition are ignored, and
// every word must match the start of a title word.

/** Folds case and strips diacritics from composed and decomposed text alike. */
export function foldText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** unicode61 token characters: letters, numbers and private-use characters. */
export function tokenize(text: string): string[] {
  return foldText(text)
    .split(/[^\p{L}\p{N}\p{Co}]+/u)
    .filter(Boolean);
}

/**
 * Parses a search box value into phrases. Each whitespace-separated word with at
 * least one letter or digit is a phrase whose last token is a prefix, like the
 * quoted `"word"*` terms the database query used. Returns null when nothing can match.
 */
export function parseTitleQuery(query: string): string[][] | null {
  const phrases = query
    .normalize('NFC')
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word))
    .map(tokenize)
    .filter((tokens) => tokens.length > 0);
  return phrases.length ? phrases : null;
}

function containsPhrase(tokens: string[], phrase: string[]): boolean {
  const last = phrase.length - 1;
  for (let start = 0; start + last < tokens.length; start++) {
    let matches = true;
    for (let offset = 0; offset <= last && matches; offset++) {
      const token = tokens[start + offset]!;
      const term = phrase[offset]!;
      matches = offset === last ? token.startsWith(term) : token === term;
    }
    if (matches) return true;
  }
  return false;
}

/** True when every phrase occurs in the title (all words are required). */
export function titleMatches(title: string, phrases: string[][]): boolean {
  const tokens = tokenize(title);
  return phrases.every((phrase) => containsPhrase(tokens, phrase));
}
