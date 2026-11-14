import { load } from 'cheerio';
import { createSourceFetcher, type FetchOptions } from '../http';
import { assertRobotsAllowPath } from '../robots';
import { parseCsv } from '../normalization/csv';
import { cleanText, dmyDate } from '../normalization/values';
import { hasCancellationNotice } from '../normalization/cancellation';
import { MALAGA_ORIGIN } from '../../centres/schema';
import { localDateIn } from '../../time/dates';
import type { CourseRecord, SourceAdapter, SourceConfig } from '../types';

// Málaga publishes its municipal agenda as one open CSV per year on
// datosabiertos.malaga.eu (CC BY-SA 4.0), updated daily: one row per activity and
// category, so an activity with two categories or specialties has two rows. The
// whole file is read once per process and shared by the venues' sources, each
// keeping the "Cursos y talleres" activities whose ID_LUGAR is its `centreCode`.
// Online courses and courses at ad hoc places carry ID_LUGAR 0 and match no venue.
// robots.txt disallows the CKAN API, so the file is requested at its fixed path.
// Phone and email columns are never read: some name individual staff.
// The file starts empty each January, so the venues are registered with mayBeEmpty.

export const COURSE_CATEGORY = 'Cursos y talleres';
const CACHE_MS = 60 * 60 * 1000;
// The 2026 file was 1.9 MB in November and grows through the year.
const MAX_BYTES = 8_000_000;

const COLUMNS = [
  'ID_ACTIVIDAD',
  'NOMBRE',
  'ID_LUGAR',
  'HORARIO',
  'F_INICIO',
  'F_FIN',
  'CATEGORIA',
  'PRECIO',
] as const;
export type MalagaRow = Record<(typeof COLUMNS)[number], string>;

/** The agenda file of a calendar year, e.g. /recursos/cultura/agenda/2026.csv. */
export const agendaPath = (year: string) =>
  `/recursos/cultura/agenda/${year}.csv`;

/** The rows of the agenda CSV with the columns the adapter uses, values as published. */
export function malagaRows(csv: string): MalagaRow[] {
  const [header, ...lines] = parseCsv(csv, ',');
  const index = COLUMNS.map((column) => {
    const i = header?.indexOf(column) ?? -1;
    if (i < 0) throw new Error(`Málaga CSV lacks column ${column}`);
    return i;
  });
  return lines
    .filter((line) => line.some(Boolean))
    .map((line) => {
      if (line.length !== header!.length)
        throw new Error('Málaga CSV row has the wrong number of fields');
      return Object.fromEntries(
        COLUMNS.map((column, i) => [column, line[index[i]!]!]),
      ) as MalagaRow;
    });
}

/** Text of a field that may contain HTML (<b>, <br>, entities), whitespace collapsed. */
export const plainText = (value: string) => cleanText(load(value).text());

/** "dd/mm/yyyy 00:00:00", the dataset's form for local dates, as an ISO date. */
export function agendaDate(value: string): string | null {
  const match = /^(\d{2}\/\d{2}\/\d{4}) 00:00:00$/u.exec(value.trim());
  return match ? dmyDate(match[1]!) : null;
}

/**
 * Only an explicit "Gratuito" is a price (free), alone or followed by registration
 * terms ("Gratuito. Previa Inscripción"). The dataset publishes no amounts for the
 * registered venues, and "Entrada libre…" or an empty field stays unknown.
 */
export function agendaPriceCents(value: string): number | null {
  return /^(?:precios?:\s*)?gratuit[oa](?:$|[\s.,;:(])/iu.test(plainText(value))
    ? 0
    : null;
}

/** The rows of each activity, by ID_ACTIVIDAD, in file order. */
export function groupActivities(rows: MalagaRow[]): MalagaRow[][] {
  const groups = new Map<string, MalagaRow[]>();
  for (const row of rows) {
    if (!/^\d{1,10}$/u.test(row.ID_ACTIVIDAD))
      throw new Error(`Málaga activity id is not numeric: ${row.ID_ACTIVIDAD}`);
    const group = groups.get(row.ID_ACTIVIDAD);
    if (group) group.push(row);
    else groups.set(row.ID_ACTIVIDAD, [row]);
  }
  return [...groups.values()];
}

/**
 * One record per activity. Its rows repeat the same activity under other
 * categories; a value is kept only when every row agrees on it, otherwise it stays
 * unknown rather than one row being picked. The title comes from the first course row.
 */
export function malagaRecord(
  rows: MalagaRow[],
  source: SourceConfig,
): CourseRecord {
  const course = rows.find((row) => row.CATEGORIA === COURSE_CATEGORY);
  if (!course) throw new Error('Málaga activity has no course row');
  const agreed = (column: keyof MalagaRow): string | null =>
    rows.every((row) => row[column] === course[column]) ? course[column] : null;
  const title = plainText(course.NOMBRE);
  const start = agreed('F_INICIO');
  const end = agreed('F_FIN');
  const price = agreed('PRECIO');
  const schedule = agreed('HORARIO');
  const startDate = start === null ? null : agendaDate(start);
  const endDate = end === null ? null : agendaDate(end);
  const priceCents = price === null ? null : agendaPriceCents(price);
  return {
    externalId: course.ID_ACTIVIDAD,
    title,
    // Activities have no page of their own; the course links to its venue's page.
    officialUrl: source.institution.url,
    category: null,
    // A reversed range is not a range; neither end is trusted.
    ...(startDate && endDate && startDate > endDate
      ? { startDate: null, endDate: null }
      : { startDate, endDate }),
    scheduleText: schedule === null ? null : plainText(schedule) || null,
    priceCents,
    currency: priceCents === null ? null : 'EUR',
    availability: null,
    isCancelled: hasCancellationNotice(title, []),
    isSoldOut: false,
    courseLanguage: null,
  };
}

/** The course records of one venue, by its ID_LUGAR. */
export function venueRecords(
  rows: MalagaRow[],
  source: SourceConfig,
): CourseRecord[] {
  if (!source.centreCode) throw new Error('Málaga source has no venue id');
  const venue = String(source.centreCode);
  return groupActivities(rows)
    .filter(
      (group) =>
        group.some((row) => row.CATEGORIA === COURSE_CATEGORY) &&
        group.every((row) => row.ID_LUGAR === venue),
    )
    .map((group) => malagaRecord(group, source));
}

async function readAgenda(options: FetchOptions, year: string) {
  const site = createSourceFetcher(MALAGA_ORIGIN, {
    // robots.txt asks for a 10-second crawl delay.
    intervalMs: 10_000,
    maxBytes: MAX_BYTES,
    ...options,
  });
  const path = agendaPath(year);
  const robots = await site(`${MALAGA_ORIGIN}/robots.txt`, true);
  if (robots !== null) assertRobotsAllowPath(robots, path);
  return malagaRows((await site(`${MALAGA_ORIGIN}${path}`))!);
}

let shared: { at: number; year: string; rows: Promise<MalagaRow[]> } | null =
  null;

function agendaFor(options: FetchOptions, year: string): Promise<MalagaRow[]> {
  // Injected fetchers (tests) never share the cached file.
  if (options.fetch) return readAgenda(options, year);
  if (!shared || shared.year !== year || Date.now() - shared.at > CACHE_MS) {
    const rows = readAgenda(options, year);
    shared = { at: Date.now(), year, rows };
    // A failed read must not be reused by the next source.
    rows.catch(() => {
      if (shared?.rows === rows) shared = null;
    });
  }
  return shared.rows;
}

export function createMalagaAdapter(
  options: FetchOptions = {},
  now: () => Date = () => new Date(),
): SourceAdapter {
  return {
    async fetchRecords(source: SourceConfig) {
      // Only the current year's file (in the venue's zone) is read.
      const year = localDateIn(source.institution.timezone, now()).slice(0, 4);
      const records = venueRecords(await agendaFor(options, year), source);
      if (!records.length && !source.mayBeEmpty)
        throw new Error('No course records fetched');
      return records;
    },
  };
}
