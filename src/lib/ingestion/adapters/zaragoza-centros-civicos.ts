import { load } from 'cheerio';
import { z } from 'zod';
import { cleanText } from '../normalization/values';
import { createSourceFetcher, type FetchOptions } from '../http';
import { assertRobotsAllowPath } from '../robots';
import { isIsoDate } from '../../time/dates';
import { ZARAGOZA_ORIGIN } from '../../centres/schema';
import type { CourseRecord, SourceAdapter, SourceConfig } from '../types';

// Zaragoza's municipal civic centres (Centros Cívicos). The city's public events API
// publishes one programme per season ("Cursos y talleres Centros Cívicos 2026-2027");
// its courses are run by local associations and listed per centre (`idLugar`). Each
// course is an event with a stable numeric id, one location, season dates and weekly
// sessions. Prices are not published (enrolment is with the organiser), so they stay
// unknown. Rehearsals and meetings of resident groups share the programme and are left out.

const PROGRAMMES_PATH =
  '/sede/servicio/actividades/evento/programa-list.json?rows=50&q=title==*Centros*&sort=id%20desc';
const listPath = (programme: number, place: number) =>
  `/sede/servicio/cultura/evento/list.json?program.id=${programme}&idLugar=${place}&rows=500&sort=id%20asc`;
export const zaragozaCourseUrl = (id: number) =>
  `${ZARAGOZA_ORIGIN}/sede/portal/centroscivicos/servicio/cultura/evento/${id}`;

const SEASON_TITLE =
  /^cursos y talleres centros c[ií]vicos (\d{4})-(?:\d{2}|\d{4})$/iu;
// Group rehearsals ("Ensayo jota aragonesa", "Ensayos musicales"), meetings and
// members' days are listed in the same programme but are not courses or workshops.
const NOT_A_COURSE = /^(?:ensayos?\b|reuni[oó]n(?:es)?\b|d[ií]a del socio$)/iu;
const DAYS = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
] as const;
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const programmesSchema = z.object({
  result: z.array(z.object({ id: z.number().int(), title: z.string() })),
});

const eventSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.array(z.object({ title: z.string().min(1) })).optional(),
  subEvent: z
    .array(
      z.object({
        location: z.object({ id: z.number().int() }),
        startDate: z.string(),
        endDate: z.string(),
        openingHours: z
          .array(
            z.object({
              dayOfWeek: z.enum(DAYS),
              startTime: time,
              endTime: time,
            }),
          )
          .default([]),
      }),
    )
    .length(1),
});

const listSchema = z.object({
  totalCount: z.number().int().nonnegative(),
  result: z.array(eventSchema),
});

/** The newest season programme among the listed ones, by its starting year. */
export function currentProgramme(json: unknown): number {
  const seasons = programmesSchema
    .parse(json)
    .result.flatMap((p) => {
      const year = SEASON_TITLE.exec(cleanText(p.title))?.[1];
      return year ? [{ id: p.id, year: Number(year) }] : [];
    })
    .sort((a, b) => b.year - a.year);
  if (!seasons.length)
    throw new Error('Zaragoza civic-centre course programme not found');
  return seasons[0]!.id;
}

const localDay = (value: string) => {
  const day = value.slice(0, 10);
  return isIsoDate(day) ? day : null;
};

/** Course records of one centre's listing; throws if any event is elsewhere. */
export function parseZaragozaList(
  json: unknown,
  place: number,
): CourseRecord[] {
  const list = listSchema.parse(json);
  // One request returns the whole listing; a larger one would need pagination.
  if (list.totalCount !== list.result.length)
    throw new Error('Zaragoza listing is incomplete');
  return list.result
    .filter((event) => !NOT_A_COURSE.test(cleanText(event.title)))
    .map((event) => {
      const session = event.subEvent[0]!;
      if (session.location.id !== place)
        throw new Error(`Event ${event.id} is listed at another centre`);
      const weekly = [...session.openingHours]
        .sort(
          (a, b) =>
            DAYS.indexOf(a.dayOfWeek) - DAYS.indexOf(b.dayOfWeek) ||
            a.startTime.localeCompare(b.startTime),
        )
        .map((h) => `${h.dayOfWeek} ${h.startTime}–${h.endTime}`);
      // Notes such as "1 jueves al mes" qualify the weekly sessions; keep them verbatim.
      const note = event.description
        ? cleanText(load(event.description).text())
        : '';
      const schedule = [weekly.join(' · '), note].filter(Boolean).join('. ');
      return {
        externalId: String(event.id),
        title: cleanText(event.title),
        officialUrl: zaragozaCourseUrl(event.id),
        category: event.category?.[0]?.title ?? null,
        startDate: localDay(session.startDate),
        endDate: localDay(session.endDate),
        scheduleText: schedule.slice(0, 1000) || null,
        priceCents: null,
        currency: null,
        availability: null,
        isCancelled: false,
        isSoldOut: false,
        courseLanguage: null,
      };
    });
}

export function createZaragozaAdapter(
  options: FetchOptions = {},
): SourceAdapter {
  return {
    async fetchRecords(source: SourceConfig) {
      const root = new URL(source.listingUrl);
      const place = Number(root.searchParams.get('idLugar'));
      if (
        root.origin !== ZARAGOZA_ORIGIN ||
        !Number.isInteger(place) ||
        place < 1
      )
        throw new Error('Zaragoza source has no centre id');
      const get = createSourceFetcher(ZARAGOZA_ORIGIN, options);
      // The `User-agent: *` group disallows /api/, *.csv and other paths; the two JSON
      // paths used here must stay allowed, re-checked on every run.
      const robots = (await get(`${ZARAGOZA_ORIGIN}/robots.txt`, true)) ?? '';
      assertRobotsAllowPath(robots, PROGRAMMES_PATH);
      const programme = currentProgramme(
        JSON.parse((await get(`${ZARAGOZA_ORIGIN}${PROGRAMMES_PATH}`))!),
      );
      const path = listPath(programme, place);
      assertRobotsAllowPath(robots, path);
      const records = parseZaragozaList(
        JSON.parse((await get(`${ZARAGOZA_ORIGIN}${path}`))!),
        place,
      );
      if (!records.length && !source.mayBeEmpty)
        throw new Error('No course records fetched');
      return records;
    },
  };
}
