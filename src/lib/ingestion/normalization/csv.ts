/**
 * Rows of a CSV with double-quoted fields ("" escapes a quote), quoted line breaks and
 * an optional UTF-8 BOM. Throws on an unterminated quoted field.
 */
export function parseCsv(text: string, delimiter = ';'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < input.length; i++) {
    const char = input[i]!;
    if (quoted) {
      if (char !== '"') field += char;
      else if (input[i + 1] === '"') field += input[++i];
      else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (quoted) throw new Error('Unterminated quoted CSV field');
  if (field || row.length) rows.push([...row, field]);
  return rows;
}
