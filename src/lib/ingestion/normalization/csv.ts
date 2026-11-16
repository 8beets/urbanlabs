import { parse } from 'csv-parse/sync';

/**
 * Rows of a CSV with double-quoted fields ("" escapes a quote), quoted line breaks and
 * an optional UTF-8 BOM. Rows keep their own length (adapters check it) and line endings
 * may be mixed. Throws on an unterminated quoted field.
 */
export function parseCsv(text: string, delimiter = ';'): string[][] {
  return parse(text, {
    delimiter,
    bom: true,
    record_delimiter: ['\r\n', '\n', '\r'],
    relax_column_count: true,
  });
}
