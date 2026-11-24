import { load } from 'cheerio';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { createSnapshotCache } from '../shared-snapshot';
import { createSourceFetcher, type FetchOptions } from '../http';
import { parseCsv } from '../normalization/csv';
import { plainText } from '../normalization/html';
import { cleanText, euroCents, localDate } from '../normalization/values';
import { hasCancellationNotice } from '../normalization/cancellation';
import type { CourseRecord, SourceAdapter, SourceConfig } from '../types';

// Barcelona publishes its city agenda as open data (agenda-diaria, CC BY 4.0) on
// opendata-ajuntament.barcelona.cat, updated daily: one row per event and filter or
// contact, so an event spans several rows. The portal answers 403 to GitHub Actions
// runners (urbanlabs#144), so a person regenerates a filtered copy from a home
// connection and commits it to urban-open-courses-data
// (scripts/filter-barcelona-agenda.py there): the "Cursos i tallers" events at casals,
// libraries, museums and ateneus, rows copied byte for byte (UTF-16LE, CRLF). The whole
// file is read once per process and shared by the venues' sources, each keeping the
// events whose every addresses_place is one of its `venues`.
// Only course facts are read: no descriptions (`body`), images or contacts.

export const MIRROR_ORIGIN = 'https://raw.githubusercontent.com';
export const MIRROR_PATH =
  '/8beets/urban-open-courses-data/main/es/catalunya/barcelona/agenda-diaria-cursos-i-tallers.csv';
// A hand-made copy only changes when someone refreshes it, so a run would always
// succeed; an old copy fails instead, which the freshness report then flags.
export const MAX_SNAPSHOT_AGE_DAYS = 31;
export const COURSE_CATEGORY = 'Cursos i tallers';
// The copy was 13.8 MB in November 2026.
const MAX_BYTES = 40_000_000;

const COLUMNS = [
  'register_id',
  'name',
  'modified',
  'addresses_place',
  'secondary_filters_fullpath',
  'start_date',
  'end_date',
  'timetable',
] as const;
export type BarcelonaRow = Record<(typeof COLUMNS)[number], string>;

/** The rows of the agenda CSV with the columns the adapter uses. */
export function barcelonaRows(csv: string): BarcelonaRow[] {
  const [header, ...lines] = parseCsv(csv, ',');
  const index = COLUMNS.map((column) => {
    const i = header?.indexOf(column) ?? -1;
    if (i < 0) throw new Error(`Barcelona CSV lacks column ${column}`);
    return i;
  });
  return lines
    .filter((line) => line.some(Boolean))
    .map((line) => {
      if (line.length !== header!.length)
        throw new Error('Barcelona CSV row has the wrong number of fields');
      return Object.fromEntries(
        COLUMNS.map((column, i) => [column, line[index[i]!]!]),
      ) as BarcelonaRow;
    });
}

/** The rows of each event, by register_id, in file order. */
export function groupEvents(rows: BarcelonaRow[]): BarcelonaRow[][] {
  // The publisher's export starts every register_id with a stray byte-order mark.
  const id = (row: BarcelonaRow) => row.register_id.replace(/^\ufeff/u, '');
  for (const row of rows)
    if (!/^\d{1,15}$/u.test(id(row)))
      throw new Error(`Barcelona event id is not numeric: ${row.register_id}`);
  return [
    ...Map.groupBy(
      rows.map((row) => ({ ...row, register_id: id(row) })),
      (row) => row.register_id,
    ).values(),
  ];
}

/** The local date of "2026-09-29T03:00:00+02:00" (the agenda's form), or null. */
export function agendaDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T/u.exec(value.trim());
  return match ? localDate(match[3]!, Number(match[2]), match[1]!) : null;
}

export interface TimetableRow {
  day: string;
  hour: string;
  price: string;
}

/** The rows of a timetable table, with cells that span rows (rowspan) repeated. */
export function timetableRows(html: string): TimetableRow[] {
  const $ = load(html);
  const columns = ['day', 'hour', 'price'] as const;
  const carry = new Map<string, { text: string; left: number }>();
  return $('tr:not(.timetable-header)')
    .toArray()
    .map((tr) => {
      const row = { day: '', hour: '', price: '' };
      for (const column of columns) {
        const cell = $(tr).children(`td.timetable-${column}`).first();
        if (cell.length) {
          const text = cleanText(cell.text());
          const span = Number(cell.attr('rowspan') ?? '1');
          carry.set(column, {
            text,
            left: Number.isInteger(span) ? span - 1 : 0,
          });
          row[column] = text;
        } else {
          const above = carry.get(column);
          if (above && above.left > 0) {
            above.left--;
            row[column] = above.text;
          }
        }
      }
      return row;
    });
}

/**
 * "Dimarts de 10.00 h a 11.00 h", one part per timetable row, or null when there is
 * none or it is longer than a record allows (1,000 characters).
 */
export function agendaSchedule(rows: TimetableRow[]): string | null {
  const text = rows
    .map((row) => cleanText(`${row.day} ${row.hour}`))
    .filter(Boolean)
    .join('; ');
  return text && text.length <= 1000 ? text : null;
}

/**
 * The base price of one price cell: "Entrada Gratuïta" is free and "Entrada general:
 * 55 €" is 55 euros, whatever notes follow (concessions and supplements are not
 * represented). Ranges ("de 30 a 45 €"), monthly or yearly fees and anything else
 * stay unknown.
 */
export function agendaPriceCents(cell: string): number | null {
  const text = cleanText(cell);
  if (/^Entrada Gratuïta(?:$|\s)/u.test(text)) return 0;
  const match =
    /^Entrada general: (\d+(?:[.,]\d{1,2})?) €(?!\s*(?:mensual|\/))/u.exec(
      text,
    );
  return match ? euroCents(match[1]!) : null;
}

/** One price for the event when every timetable row states the same one. */
function eventPriceCents(rows: TimetableRow[]): number | null {
  const prices = rows.map((row) => agendaPriceCents(row.price));
  return prices.length && prices.every((p) => p !== null && p === prices[0])
    ? prices[0]!
    : null;
}

/**
 * One record per event. Its rows repeat the same event once per filter or contact; the
 * values read here are the same on all of them, so the first row is used.
 */
export function barcelonaRecord(rows: BarcelonaRow[]): CourseRecord {
  const event = rows[0]!;
  const title = plainText(event.name);
  const timetable = timetableRows(event.timetable);
  const startDate = agendaDate(event.start_date);
  const endDate = agendaDate(event.end_date);
  const priceCents = eventPriceCents(timetable);
  return {
    externalId: event.register_id,
    title,
    // The event's page in the city guide (guia.barcelona.cat ignores the slug).
    officialUrl: `https://guia.barcelona.cat/ca/detall/_${event.register_id}.html`,
    category: null,
    // A reversed range is not a range; neither end is trusted.
    ...(startDate && endDate && startDate > endDate
      ? { startDate: null, endDate: null }
      : { startDate, endDate }),
    scheduleText: agendaSchedule(timetable),
    priceCents,
    currency: priceCents === null ? null : 'EUR',
    availability: null,
    isCancelled: hasCancellationNotice(title, []),
    isSoldOut: false,
    courseLanguage: null,
  };
}

/**
 * The course records of one venue: events filed as courses whose every named place is
 * one of its places. A blank place (an address without a venue name) names no other
 * venue; an event also held at another venue belongs to neither.
 */
export function venueRecords(
  rows: BarcelonaRow[],
  source: SourceConfig,
): CourseRecord[] {
  if (!source.venues?.length) throw new Error('Barcelona source has no places');
  const places = new Set(source.venues);
  return groupEvents(rows)
    .filter((group) => {
      const named = group
        .map((row) => row.addresses_place.trim())
        .filter(Boolean);
      return (
        group.some((row) =>
          row.secondary_filters_fullpath.includes(COURSE_CATEGORY),
        ) &&
        named.length > 0 &&
        named.every((place) => places.has(place))
      );
    })
    .map((group) => barcelonaRecord(group));
}

/** Throws when the copy's newest `modified` is too old (or unreadable). */
export function assertRecentSnapshot(
  rows: BarcelonaRow[],
  now = new Date(),
): void {
  const dates = rows.map((row) => agendaDate(row.modified));
  if (!dates.length || dates.some((date) => date === null))
    throw new Error('Barcelona CSV has no readable modified dates');
  const newest = (dates as string[]).sort().at(-1)!;
  const age = differenceInCalendarDays(now, parseISO(newest));
  if (age > MAX_SNAPSHOT_AGE_DAYS)
    throw new Error(
      `Barcelona agenda copy is ${age} days old (newest change ${newest}); regenerate it in urban-open-courses-data`,
    );
}

async function readSnapshot(
  options: FetchOptions,
  now: Date,
): Promise<BarcelonaRow[]> {
  const site = createSourceFetcher(MIRROR_ORIGIN, {
    maxBytes: MAX_BYTES,
    encoding: 'utf-16le',
    ...options,
  });
  const rows = barcelonaRows((await site(`${MIRROR_ORIGIN}${MIRROR_PATH}`))!);
  assertRecentSnapshot(rows, now);
  return rows;
}

const sharedSnapshot = createSnapshotCache<BarcelonaRow[]>();

export function createBarcelonaAgendaAdapter(
  options: FetchOptions = {},
  now: () => Date = () => new Date(),
): SourceAdapter {
  return {
    async fetchRecords(source: SourceConfig) {
      const rows = await sharedSnapshot(options, () =>
        readSnapshot(options, now()),
      );
      const records = venueRecords(rows, source);
      if (!records.length && !source.mayBeEmpty)
        throw new Error('No course records fetched');
      return records;
    },
  };
}
