import { createHash } from 'node:crypto';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { createSourceFetcher, type FetchOptions } from '../http';
import { parseCsv } from '../normalization/csv';
import { dmyDate } from '../normalization/values';
import { weekdayNames } from '../../time/dates';
import type { CourseRecord, SourceAdapter, SourceConfig } from '../types';

// Madrid publishes the courses and workshops of its district cultural centres as one
// open dataset (CC BY 4.0) on datos.madrid.es, one row per course group. Its robots.txt
// disallows automated downloads, so a person downloads the CSV by hand and commits it
// unchanged to the urban-open-courses-data repository, which this adapter reads. The
// whole snapshot is read once per process and shared by the centres' sources, each
// keeping the rows whose ORGANISMO_DESC is its `organism`.
// The dataset has no course dates, prices, pages or ids: dates and price stay unknown,
// the course links to its centre's page, and the identity is documented below.
// NUM_PLAZAS_LIBRES is the snapshot's count, so "0" is an explicit "no places left".

export const MIRROR_ORIGIN = 'https://raw.githubusercontent.com';
export const MIRROR_PATH =
  '/8beets/urban-open-courses-data/main/es/comunidad-de-madrid/madrid/50064-45-talleres-culturales-cursos.csv';
// A hand-downloaded file only changes when someone updates it, so a run would always
// succeed; an old snapshot fails instead, which the freshness report then flags.
export const MAX_SNAPSHOT_AGE_DAYS = 31;
const CACHE_MS = 60 * 60 * 1000;
const DAYS = [
  'LUNES',
  'MARTES',
  'MIERCOLES',
  'JUEVES',
  'VIERNES',
  'SABADO',
  'DOMINGO',
] as const;
const DAY_NAMES = weekdayNames('es');
const dayList = new Intl.ListFormat('es', { type: 'conjunction' });

export { parseCsv };

export type MadridRow = Record<string, string>;

export function madridRows(csv: string): MadridRow[] {
  const [header, ...lines] = parseCsv(csv);
  const required = [
    'ORGANISMO_DESC',
    'ACTIVIDAD_DESC',
    'GRUPO_DESC',
    'DESTINATARIO_DESC',
    'NUM_PLAZAS_LIBRES',
    'FECHA_DATOS_FIN',
    ...DAYS.flatMap((d) => [`DURACION_ACTIVIDAD_${d}`, `HORA_INICIO_${d}`]),
  ];
  for (const column of required)
    if (!header?.includes(column))
      throw new Error(`Madrid CSV lacks column ${column}`);
  return lines
    .filter((line) => line.some(Boolean))
    .map((line) => {
      if (line.length !== header!.length)
        throw new Error('Madrid CSV row has the wrong number of fields');
      return Object.fromEntries(
        header!.map((name, i) => [name, line[i]!.trim()]),
      );
    });
}

/** "Lunes y miércoles, 19:00 (1 hora)", or per day when times differ. */
export function madridSchedule(row: MadridRow): string | null {
  const sessions = DAYS.flatMap((day, i) => {
    const start = row[`HORA_INICIO_${day}`];
    if (!start) return [];
    const length = row[`DURACION_ACTIVIDAD_${day}`]?.toLocaleLowerCase('es');
    return [
      { day: DAY_NAMES[i]!, time: length ? `${start} (${length})` : start },
    ];
  });
  if (!sessions.length) return null;
  const capitalise = (text: string) => text[0]!.toUpperCase() + text.slice(1);
  if (sessions.every((s) => s.time === sessions[0]!.time))
    return `${capitalise(dayList.format(sessions.map((s) => s.day)))}, ${sessions[0]!.time}`;
  return capitalise(sessions.map((s) => `${s.day} ${s.time}`).join('; '));
}

/**
 * The dataset has no ids. A group is its centre's activity, group and audience (the
 * same group name can exist for children and adults); a renamed activity or group
 * therefore becomes a new edition. The readable slug is followed by a hash of the
 * exact source values, so different spellings never merge.
 */
export function madridExternalId(row: MadridRow): string {
  const key = [row.ACTIVIDAD_DESC, row.GRUPO_DESC, row.DESTINATARIO_DESC].join(
    '\u0000',
  );
  const slug = row
    .ACTIVIDAD_DESC!.normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  const hash = createHash('sha256').update(key).digest('hex').slice(0, 12);
  return `${slug || 'curso'}-${hash}`;
}

export function madridRecord(
  row: MadridRow,
  source: SourceConfig,
): CourseRecord {
  return {
    externalId: madridExternalId(row),
    title: row.ACTIVIDAD_DESC!,
    officialUrl: source.institution.url,
    category: null,
    startDate: null,
    endDate: null,
    scheduleText: madridSchedule(row),
    priceCents: null,
    currency: null,
    availability: null,
    isCancelled: false,
    isSoldOut: row.NUM_PLAZAS_LIBRES === '0',
    courseLanguage: null,
  };
}

/** Throws when the snapshot's newest FECHA_DATOS_FIN is too old (or unreadable). */
export function assertRecentSnapshot(
  rows: MadridRow[],
  now = new Date(),
): void {
  const dates = rows.map((row) => dmyDate(row.FECHA_DATOS_FIN!));
  if (!dates.length || dates.some((date) => date === null))
    throw new Error('Madrid CSV has no readable FECHA_DATOS_FIN');
  const newest = (dates as string[]).sort().at(-1)!;
  const age = differenceInCalendarDays(now, parseISO(newest));
  if (age > MAX_SNAPSHOT_AGE_DAYS)
    throw new Error(
      `Madrid snapshot is ${age} days old (FECHA_DATOS_FIN ${newest}); download a new one`,
    );
}

async function readSnapshot(options: FetchOptions): Promise<MadridRow[]> {
  const site = createSourceFetcher(MIRROR_ORIGIN, {
    // The file was 1.4 MB in November 2026.
    maxBytes: 8_000_000,
    ...options,
  });
  const rows = madridRows((await site(`${MIRROR_ORIGIN}${MIRROR_PATH}`))!);
  assertRecentSnapshot(rows);
  return rows;
}

let shared: { at: number; rows: Promise<MadridRow[]> } | null = null;

function snapshotFor(options: FetchOptions): Promise<MadridRow[]> {
  // Injected fetchers (tests) never share the cached snapshot.
  if (options.fetch) return readSnapshot(options);
  if (!shared || Date.now() - shared.at > CACHE_MS) {
    const rows = readSnapshot(options);
    shared = { at: Date.now(), rows };
    // A failed read must not be reused by the next source.
    rows.catch(() => {
      if (shared?.rows === rows) shared = null;
    });
  }
  return shared.rows;
}

export function createMadridAdapter(options: FetchOptions = {}): SourceAdapter {
  return {
    async fetchRecords(source: SourceConfig) {
      if (!source.venue) throw new Error('Madrid source has no organism');
      const records = (await snapshotFor(options))
        .filter((row) => row.ORGANISMO_DESC === source.venue)
        .map((row) => madridRecord(row, source));
      if (!records.length && !source.mayBeEmpty)
        throw new Error('No course records fetched');
      return records;
    },
  };
}
