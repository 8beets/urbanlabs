import { load } from 'cheerio';
import { cleanText, dmyDate, euroCents } from '../normalization/values';
import { createSourceFetcher, type FetchOptions } from '../http';
import { assertRobotsAllowPath } from '../robots';
import { VITORIA_ORIGIN } from '../../centres/schema';
import type { CourseRecord, SourceAdapter, SourceConfig } from '../types';

// Vitoria-Gasteiz publishes the courses of its civic centres (and sports facilities) in
// the sede electrónica's activity search (m01-10s). Per season (`anio`, the year the
// season starts) each centre lists its activities, each activity its groups, and each
// group has a detail page with dates, weekdays, times, places and tariffs. A group's
// id ("2026||4||AGIA||2||1": season, centre, activity, group, part) is stable within
// the season. Descriptions, requirements and material costs are not imported.

const PATH = '/m01-10s/actividadAction.do';
const MAX_GROUPS = 600;
const MAX_PAGES = 10;
const DAYS: Record<string, string> = {
  L: 'lunes',
  M: 'martes',
  X: 'miércoles',
  J: 'jueves',
  V: 'viernes',
  S: 'sábado',
  D: 'domingo',
};

export interface VitoriaGroup {
  id: string;
  path: string;
  cancelled: boolean;
}

const sitePath = (href: string) => {
  const url = new URL(href, VITORIA_ORIGIN);
  if (url.origin !== VITORIA_ORIGIN || url.pathname !== PATH)
    throw new Error(`Unexpected Vitoria-Gasteiz link: ${href}`);
  return url.pathname + url.search;
};

/** The season the activity search currently shows (its `anio`). */
export function currentSeason(html: string): number {
  const $ = load(html);
  const years = new Set(
    $(`a[href*="${PATH}"]`)
      .map((_, a) =>
        new URL($(a).attr('href')!, VITORIA_ORIGIN).searchParams.get('anio'),
      )
      .get()
      .filter((year): year is string => /^\d{4}$/.test(year ?? '')),
  );
  if (years.size !== 1)
    throw new Error('Vitoria-Gasteiz activity season not found');
  return Number([...years][0]);
}

/** Paths of a centre's activities (each lists that activity's groups at the centre). */
export function parseCentreActivities(html: string, centre: number): string[] {
  const $ = load(html);
  return [
    ...new Set(
      $('ul.listaDosColumnas a[href]')
        .map((_, a) => sitePath($(a).attr('href')!))
        .get()
        .filter((path) => {
          const params = new URL(path, VITORIA_ORIGIN).searchParams;
          return (
            params.get('accion') === 'verCentros' &&
            params.get('cen') === String(centre) &&
            params.has('activ')
          );
        }),
    ),
  ];
}

export interface VitoriaGroupPage {
  groups: VitoriaGroup[];
  /** Total groups of the activity at the centre ("1-20 de 24"). */
  total: number;
  /** The next page of groups, if any (20 per page). */
  next: string | null;
}

/** One page of the groups of an activity at a centre, with the listing's status. */
export function parseActivityGroups(html: string): VitoriaGroupPage {
  const $ = load(html);
  const count = cleanText($('.paginacionsup .paginacionIzq').text()).match(
    /^(\d+)-(\d+) de (\d+)$/u,
  );
  const nextLink = $('.paginacionsup .paginacionDcha a')
    .filter((_, a) => cleanText($(a).text()) === '>')
    .first();
  // The status column is optional in the listing template.
  const statusColumn = $('table thead th')
    .map((_, th) => cleanText($(th).text()))
    .get()
    .indexOf('Situación');
  const groups = $('table tbody tr')
    .map((_, tr) => {
      const link = $(tr).find('a[href*="detalle=detalle"]').first();
      if (!link.length) return [];
      const path = sitePath(link.attr('href')!);
      const id = new URL(path, VITORIA_ORIGIN).searchParams.get('id') ?? '';
      if (!/^\d{4}(\|\|[A-Za-z0-9]+){4}$/.test(id))
        throw new Error(`Unexpected Vitoria-Gasteiz group id: ${id}`);
      const status =
        statusColumn < 0
          ? ''
          : cleanText($(tr).children('td').eq(statusColumn).text());
      return [
        {
          id,
          path,
          cancelled: /anulad|suspendid|cancelad/iu.test(status),
        },
      ];
    })
    .get();
  return {
    groups,
    total: count ? Number(count[3]) : groups.length,
    next: nextLink.length ? sitePath(nextLink.attr('href')!) : null,
  };
}

/** Every group of an activity at a centre, following its pages. */
async function activityGroups(
  site: (url: string) => Promise<string | null>,
  activity: string,
): Promise<VitoriaGroup[]> {
  const groups: VitoriaGroup[] = [];
  let path: string | null = activity;
  let total = 0;
  for (let page = 0; path; page++) {
    if (page >= MAX_PAGES)
      throw new Error('Vitoria-Gasteiz group page limit exceeded');
    const parsed = parseActivityGroups(
      (await site(`${VITORIA_ORIGIN}${path}`))!,
    );
    groups.push(...parsed.groups);
    total = parsed.total;
    path = parsed.next;
  }
  // A missing page must not silently drop groups.
  if (new Set(groups.map((group) => group.id)).size !== total)
    throw new Error(`Vitoria-Gasteiz listing ${activity} is incomplete`);
  return groups;
}

/** Price in cents from the normal tariff, for joining on the first day only. */
export function normalTariffCents(html: string, startDate: string | null) {
  const $ = load(html);
  const table = $('#detalleAct table').first();
  // The first column is the price when joining on the first day: the whole course.
  const firstJoin = cleanText(table.find('thead th').eq(1).text()).match(
    /(\d{2}\/\d{2}\/\d{4})$/u,
  );
  if (!firstJoin || dmyDate(firstJoin[1]!) !== startDate) return null;
  const row = table
    .find('tbody tr')
    .filter((_, tr) =>
      /^TARIFA NORMAL$/u.test(cleanText($(tr).children('td').first().text())),
    );
  const price = cleanText(row.children('td').eq(1).text()).match(
    /^(\d+(?:\.\d{1,2})?) €$/u,
  );
  return row.length === 1 && price ? euroCents(price[1]!) : null;
}

const dayList = new Intl.ListFormat('es', { type: 'conjunction' });

function weekdays(code: string): string | null {
  const days = code.split('-').map((day) => DAYS[day]);
  return days.every(Boolean) ? dayList.format(days as string[]) : null;
}

export function parseVitoriaGroup(
  html: string,
  group: VitoriaGroup,
  source: SourceConfig,
): CourseRecord {
  const $ = load(html);
  const values = new Map<string, string>();
  $('#detalleAct dl dt').each((_, dt) => {
    values.set(
      cleanText($(dt).text()).replace(/:$/u, ''),
      cleanText($(dt).next('dd').text()),
    );
  });
  const title = cleanText($('h4').first().text());
  if (!title || values.get('Centro') !== source.venue)
    throw new Error(
      `Vitoria-Gasteiz group ${group.id} is not at ${source.venue}`,
    );
  const period = values
    .get('Fechas')
    ?.match(/^(\d{2}\/\d{2}\/\d{4}) - (\d{2}\/\d{2}\/\d{4})$/u);
  const startDate = period ? dmyDate(period[1]!) : null;
  const endDate = period ? dmyDate(period[2]!) : null;
  const daysCode = values.get('Días') ?? '';
  const schedule = [weekdays(daysCode) ?? daysCode, values.get('Horario') ?? '']
    .filter(Boolean)
    .join(' · ');
  const free = values.get('Plazas Libres')?.match(/^\d+$/u)?.[0];
  const price = normalTariffCents(html, startDate);
  return {
    externalId: group.id.replaceAll('||', '-'),
    title,
    officialUrl: `${VITORIA_ORIGIN}${group.path}`,
    category: null,
    startDate,
    endDate,
    scheduleText: schedule || null,
    priceCents: price,
    currency: price === null ? null : 'EUR',
    availability: null,
    isCancelled: group.cancelled,
    isSoldOut: free === '0',
    courseLanguage: null,
  };
}

export function createVitoriaAdapter(
  options: FetchOptions = {},
): SourceAdapter {
  return {
    async fetchRecords(source: SourceConfig) {
      const centre = source.centreCode;
      if (!centre || !source.venue)
        throw new Error('Vitoria-Gasteiz source has no centre code or venue');
      const site = createSourceFetcher(VITORIA_ORIGIN, options);
      // /robots.txt redirects (301) to /portal/robots.txt, the site's robots file.
      const robots = await site(`${VITORIA_ORIGIN}/portal/robots.txt`, true);
      if (robots !== null)
        assertRobotsAllowPath(robots, `${PATH}?accion=verCentros`);
      const season = currentSeason(
        (await site(`${VITORIA_ORIGIN}${PATH}?accion=inicio`))!,
      );
      const activities = parseCentreActivities(
        (await site(
          `${VITORIA_ORIGIN}${PATH}?accion=verCentros&cen=${centre}&anio=${season}`,
        ))!,
        centre,
      );
      const groups: VitoriaGroup[] = [];
      for (const activity of activities) {
        groups.push(...(await activityGroups(site, activity)));
        if (groups.length > MAX_GROUPS)
          throw new Error('Vitoria-Gasteiz group limit exceeded');
      }
      const records = new Map<string, CourseRecord>();
      for (const group of groups) {
        const html = await site(`${VITORIA_ORIGIN}${group.path}`);
        const record = parseVitoriaGroup(html!, group, source);
        records.set(record.externalId, record);
      }
      if (!records.size && !source.mayBeEmpty)
        throw new Error('No course records fetched');
      return [...records.values()];
    },
  };
}
