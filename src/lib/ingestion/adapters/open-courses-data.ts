import { z } from 'zod';
import { createSourceFetcher, type FetchOptions } from '../http';
import { assertRobotsAllowPath } from '../robots';
import { parseCsv } from '../normalization/csv';
import { cleanText, euroCents } from '../normalization/values';
import { OPEN_DATA_ORIGIN, openDataRawPath } from '../../centres/schema';
import type { CourseRecord, SourceAdapter, SourceConfig } from '../types';

// Course data maintained by hand in the public repository
// 8beets/urban-open-courses-data: one courses.csv per city folder, one row per course
// edition, naming its centre by the centre's id in that folder's centres.csv. The file is
// read once per process and shared by the city's centres. A malformed row fails the
// whole snapshot, so a typo never publishes partial or wrong data; the previous data
// stays. The format is specified in docs/open-courses-data.md.

const CACHE_MS = 60 * 60 * 1000;
export const REQUIRED_COLUMNS = [
  'centre_id',
  'course_id',
  'title',
  'official_url',
] as const;
export const OPTIONAL_COLUMNS = [
  'category',
  'start_date',
  'end_date',
  'schedule',
  'price_eur',
  'status',
] as const;
type Column =
  (typeof REQUIRED_COLUMNS)[number] | (typeof OPTIONAL_COLUMNS)[number];
export type OpenDataRow = Record<Column, string> & { row: number };

const optional = (schema: z.ZodType<string>) =>
  z.union([z.literal('').transform(() => null), schema]);

const rowSchema = z.object({
  centre_id: z.string().regex(/^[a-z0-9-]{1,100}$/, 'lower-case id'),
  course_id: z
    .string()
    .regex(/^[A-Za-z0-9._~:-]{1,120}$/, 'letters, digits and ._~:- only'),
  title: z.string().min(1, 'required').max(500),
  official_url: z
    .url()
    .refine((value) => value.startsWith('https://'), 'must be https'),
  category: optional(z.string().max(200)),
  start_date: optional(z.iso.date('YYYY-MM-DD')),
  end_date: optional(z.iso.date('YYYY-MM-DD')),
  schedule: optional(z.string().max(1000)),
  price_eur: optional(
    z.string().refine((value) => euroCents(value) !== null, 'e.g. 12.50 or 0'),
  ),
  status: z.enum(['', 'cancelled', 'sold-out']),
});

/** The rows of a courses.csv, trimmed, with every known column present. */
export function openDataRows(csv: string): OpenDataRow[] {
  const [header, ...lines] = parseCsv(csv, ',');
  const columns = (header ?? []).map((name) => name.trim());
  for (const column of REQUIRED_COLUMNS)
    if (!columns.includes(column))
      throw new Error(`courses.csv lacks column ${column}`);
  if (new Set(columns).size !== columns.length)
    throw new Error('courses.csv repeats a column');
  return lines.flatMap((line, index) => {
    if (!line.some((value) => value.trim())) return [];
    // Row 1 is the header; quoted line breaks can make file lines differ.
    const row = index + 2;
    if (line.length !== columns.length)
      throw new Error(`courses.csv row ${row} has the wrong number of fields`);
    const value = (column: Column) => {
      const i = columns.indexOf(column);
      return i < 0 ? '' : line[i]!.trim();
    };
    return [
      {
        row,
        ...(Object.fromEntries(
          [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS].map((column) => [
            column,
            value(column),
          ]),
        ) as Record<Column, string>),
      },
    ];
  });
}

/** A validated record; throws naming the row and column on any invalid value. */
export function openDataRecord(row: OpenDataRow): CourseRecord {
  const parsed = rowSchema.safeParse(row);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    throw new Error(
      `courses.csv row ${row.row}, ${String(issue.path[0] ?? 'row')}: ${issue.message}`,
    );
  }
  const data = parsed.data;
  if (data.start_date && data.end_date && data.start_date > data.end_date)
    throw new Error(`courses.csv row ${row.row}: start_date is after end_date`);
  const priceCents = data.price_eur === null ? null : euroCents(data.price_eur);
  return {
    externalId: data.course_id,
    title: cleanText(data.title),
    officialUrl: data.official_url,
    category: data.category && cleanText(data.category),
    startDate: data.start_date,
    endDate: data.end_date,
    scheduleText: data.schedule && cleanText(data.schedule),
    priceCents,
    currency: priceCents === null ? null : 'EUR',
    availability: null,
    isCancelled: data.status === 'cancelled',
    isSoldOut: data.status === 'sold-out',
    courseLanguage: null,
  };
}

export interface CityRecord {
  centreId: string;
  record: CourseRecord;
}

/** Every row of a city's courses.csv, validated; one bad row fails them all. */
export function cityRecords(csv: string): CityRecord[] {
  return openDataRows(csv).map((row) => ({
    centreId: row.centre_id,
    record: openDataRecord(row),
  }));
}

/** One centre's records from its city's records. */
export function centreRecords(
  records: CityRecord[],
  source: SourceConfig,
): CourseRecord[] {
  if (!source.venue) throw new Error('Open-data source has no centre id');
  return records
    .filter((entry) => entry.centreId === source.venue)
    .map((entry) => entry.record);
}

/** The city's records, or null when the folder has no courses.csv yet. */
async function readCity(
  options: FetchOptions,
  folder: string,
): Promise<CityRecord[] | null> {
  const site = createSourceFetcher(OPEN_DATA_ORIGIN, options);
  const path = openDataRawPath(folder, 'courses.csv');
  const robots = await site(`${OPEN_DATA_ORIGIN}/robots.txt`, true);
  if (robots !== null) assertRobotsAllowPath(robots, path);
  const csv = await site(`${OPEN_DATA_ORIGIN}${path}`, true);
  return csv === null ? null : cityRecords(csv);
}

const shared = new Map<
  string,
  { at: number; rows: Promise<CityRecord[] | null> }
>();

function cityFor(options: FetchOptions, folder: string) {
  // Injected fetchers (tests) never share the cache.
  if (options.fetch) return readCity(options, folder);
  const cached = shared.get(folder);
  if (cached && Date.now() - cached.at <= CACHE_MS) return cached.rows;
  const rows = readCity(options, folder);
  shared.set(folder, { at: Date.now(), rows });
  // A failed read must not be reused by the next centre.
  rows.catch(() => {
    if (shared.get(folder)?.rows === rows) shared.delete(folder);
  });
  return rows;
}

export function createOpenDataAdapter(
  options: FetchOptions = {},
): SourceAdapter {
  return {
    async fetchRecords(source: SourceConfig) {
      if (!source.dataFolder) throw new Error('Open-data source has no folder');
      const rows = await cityFor(options, source.dataFolder);
      const records = rows === null ? [] : centreRecords(rows, source);
      if (!records.length && !source.mayBeEmpty)
        throw new Error(
          rows === null
            ? `No courses.csv in ${source.dataFolder}`
            : 'No course records fetched',
        );
      return records;
    },
  };
}
