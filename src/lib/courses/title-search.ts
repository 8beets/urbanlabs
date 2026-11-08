// Builds an FTS5 MATCH expression for the title index (see migration 0008).
// Every word must match as a prefix, so typing is forgiving while results stay
// predictable. Quoting each word keeps FTS5 operators from user input inert.
export function titleSearchMatch(query: string): string | null {
  const words = query
    .normalize('NFC')
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word))
    .map((word) => `"${word.replaceAll('"', '""')}"*`);
  return words.length ? words.join(' ') : null;
}
