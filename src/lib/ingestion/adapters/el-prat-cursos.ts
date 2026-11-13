import { load } from 'cheerio';
import { cleanText, dmyDate, euroCents } from '../normalization/values';
import { createSourceFetcher, type FetchOptions } from '../http';
import { assertRobotsAllowPath } from '../robots';
import { EL_PRAT_ORIGIN } from '../../centres/schema';
import type { CourseRecord, SourceAdapter, SourceConfig } from '../types';

// El Prat de Llobregat publishes one course guide for the whole city on www.elprat.cat
// ("Guia de cursos i tallers"): paged listing cards give the course page, its type
// (the source category), the centre (linked by the centre's page) and whether it is
// cancelled; each course page gives the dates and times ("Quan") and the price
// ("Inscripció"). The course page's slug is stable and is the external id. Course
// descriptions and organisers are not imported.

const GUIDE = '/la-ciutat/guia-cursos-i-tallers';
// robots.txt asks for a 10-second crawl delay.
const CRAWL_DELAY_MS = 10_000;
const MAX_PAGES = 30;
const MAX_COURSES = 200;

export interface ElPratListing {
  slug: string;
  type: string | null;
  centrePage: string;
  cancelled: boolean;
}

const sitePath = (href: string) => {
  const url = new URL(href, EL_PRAT_ORIGIN);
  if (url.origin !== EL_PRAT_ORIGIN)
    throw new Error(`Unexpected El Prat link: ${href}`);
  return url.pathname;
};

/** One page of the guide: its course cards and the next page, if any. */
export function parseElPratListing(html: string): {
  courses: ElPratListing[];
  next: string | null;
} {
  const $ = load(html);
  const courses = $('.contingut-fitxa')
    .map((_, card) => {
      const link = $(card).find('h4 a[href]').first();
      const centre = $(card).find('a.equipament_link[href]').first();
      const slug = sitePath(link.attr('href') ?? '').match(
        /^\/la-ciutat\/guia-cursos-i-tallers\/([a-z0-9-]+)$/u,
      )?.[1];
      if (!slug || !centre.length) return [];
      // "Cuina | Centre Cívic …": the type precedes the centre in the card.
      const type = cleanText(
        $(card).find('p').first().contents().first().text(),
      ).replace(/\s*\|$/u, '');
      return [
        {
          slug,
          type: type || null,
          centrePage: sitePath(centre.attr('href')!),
          cancelled: $(card).find('.activitat-cancelada').length > 0,
        },
      ];
    })
    .get();
  // Drupal's pager: the "next" item's text is mislabelled, so its class is used.
  const next = $('ul.pager li.pager-next a[href]').first().attr('href');
  const url = next ? new URL(next, EL_PRAT_ORIGIN) : null;
  if (url && (url.origin !== EL_PRAT_ORIGIN || url.pathname !== GUIDE))
    throw new Error(`Unexpected El Prat pager link: ${next}`);
  return { courses, next: url ? url.pathname + url.search : null };
}

/** Start and end dates from the "Quan" text; a single date is a one-day course. */
export function elPratDates(when: string): {
  startDate: string | null;
  endDate: string | null;
} {
  const range = when.match(
    /^Del (\d{2}\/\d{2}\/\d{4})(?: - \d{1,2}:\d{2} h)? al (\d{2}\/\d{2}\/\d{4})\b/u,
  );
  if (range)
    return { startDate: dmyDate(range[1]!), endDate: dmyDate(range[2]!) };
  const dates = when.match(/\d{2}\/\d{2}\/\d{4}/gu) ?? [];
  if (dates.length === 1 && when.startsWith(dates[0]!))
    return { startDate: dmyDate(dates[0]!), endDate: dmyDate(dates[0]!) };
  return { startDate: null, endDate: null };
}

/**
 * The "Quan" text without its dates, which the card shows separately: "Divendres, de
 * 18 a 20 h (1 sessió)". Times given inside a date range are kept ("11:00 - 13:00 h").
 */
export function elPratSchedule(when: string): string | null {
  const match = when.match(
    /^(?:Del \d{2}\/\d{2}\/\d{4}(?: - (\d{1,2}:\d{2}) h)? al \d{2}\/\d{2}\/\d{4}(?: - (\d{1,2}:\d{2}) h)?|\d{2}\/\d{2}\/\d{4})\s*/u,
  );
  if (!match) return when || null;
  const rest = when.slice(match[0].length).trim();
  if (rest) return rest;
  return match[1] && match[2] ? `${match[1]} - ${match[2]} h` : null;
}

/** Price in cents from the "Inscripció" text: "37€ 9 sessions", "Inscripció gratuïta". */
export function elPratPriceCents(text: string): number | null {
  if (/^(?:Inscripció gratuïta|Gratuït)\b/u.test(text)) return 0;
  const price = text.match(/^(\d+(?:[.,]\d{1,2})?) ?€(?:\s|$)/u);
  return price ? euroCents(price[1]!) : null;
}

export function parseElPratCourse(
  html: string,
  listing: ElPratListing,
  source: SourceConfig,
): CourseRecord {
  const $ = load(html);
  const section = (icon: string) => $(`h3:has(span.icon-${icon})`).first();
  const title = cleanText($('h1').first().text());
  const centre = section('on').nextAll('a[href]').not('[target]').first();
  if (
    !title ||
    !centre.length ||
    sitePath(centre.attr('href')!) !== source.venue
  )
    throw new Error(`El Prat course ${listing.slug} is not at ${source.venue}`);
  const when = cleanText(section('quan').next('span').text());
  // The price is the block's text after its heading, with or without a <p>.
  const priceText = cleanText(section('preu').parent().text()).replace(
    /^Inscripció\s*/u,
    '',
  );
  const price = elPratPriceCents(priceText);
  return {
    externalId: listing.slug,
    title,
    officialUrl: `${EL_PRAT_ORIGIN}${GUIDE}/${listing.slug}`,
    category: listing.type,
    ...elPratDates(when),
    scheduleText: elPratSchedule(when),
    priceCents: price,
    currency: price === null ? null : 'EUR',
    availability: null,
    isCancelled: listing.cancelled,
    isSoldOut: false,
    courseLanguage: null,
  };
}

export function createElPratAdapter(options: FetchOptions = {}): SourceAdapter {
  return {
    async fetchRecords(source: SourceConfig) {
      if (!source.venue) throw new Error('El Prat source has no centre page');
      const site = createSourceFetcher(EL_PRAT_ORIGIN, {
        ...options,
        intervalMs: options.intervalMs ?? CRAWL_DELAY_MS,
      });
      const robots = await site(`${EL_PRAT_ORIGIN}/robots.txt`, true);
      if (robots !== null) assertRobotsAllowPath(robots, `${GUIDE}?page=1`);
      const courses = new Map<string, ElPratListing>();
      let path: string | null = GUIDE;
      for (let page = 0; path; page++) {
        if (page >= MAX_PAGES)
          throw new Error('El Prat guide page limit exceeded');
        const parsed = parseElPratListing(
          (await site(`${EL_PRAT_ORIGIN}${path}`))!,
        );
        for (const course of parsed.courses)
          if (course.centrePage === source.venue)
            courses.set(course.slug, course);
        path = parsed.next;
      }
      if (courses.size > MAX_COURSES)
        throw new Error('El Prat course limit exceeded');
      const records: CourseRecord[] = [];
      for (const course of courses.values()) {
        const html = await site(`${EL_PRAT_ORIGIN}${GUIDE}/${course.slug}`);
        records.push(parseElPratCourse(html!, course, source));
      }
      if (!records.length && !source.mayBeEmpty)
        throw new Error('No course records fetched');
      return records;
    },
  };
}
