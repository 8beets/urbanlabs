import { load } from 'cheerio';
import {
  catalanMonthNumber,
  cleanText,
  euroCents,
  localDate,
} from '../normalization/values';
import { createSourceFetcher, type FetchOptions } from '../http';
import { assertRobotsAllowAll } from '../robots';
import type { CourseRecord, SourceAdapter, SourceConfig } from '../types';

// Tarragona's municipal civic-centre network. The programme is published on
// www.tarragona.cat (a CMS whose term path, e.g. "t2026", changes every season); each
// workshop links to its registration page on inscripcions.tarragona.cat, which carries
// the structured details. The registration home page itself blocks automated clients,
// so only the linked activity pages are read. Scope: the "Activitats i cursos
// monogràfics" category pages (courses and workshops); shows, exhibitions and talks
// are other programme sections that are not followed.

export const TARRAGONA_REGISTRATION_ORIGIN =
  'https://inscripcions.tarragona.cat';
const INDEX_PATH = '/centrescivics/activitats-i-cursos/activitats-i-cursos';
const MAX_PAGES = 30;
const MAX_ACTIVITIES = 300;

function activityDates(line: string): [string | null, string | null] {
  const dates = [...line.matchAll(/(\d{1,2})\s+([\p{L}]+)\s+(\d{4})/gu)].map(
    (m) => localDate(m[1]!, catalanMonthNumber(m[2]!), m[3]!),
  );
  if (dates.length === 1) return [dates[0]!, dates[0]!];
  if (dates.length === 2) return [dates[0]!, dates[1]!];
  return [null, null];
}

function priceCents(text: string): number | null {
  if (/^gratu[ïi]t$/iu.test(text)) return 0;
  const match = text.match(/^(\d+(?:[.,]\d{1,2})?)\s*€$/u);
  return match ? euroCents(match[1]!) : null;
}

/** Parses one registration page (schema.org Event plus the visible detail blocks). */
export function parseTarragonaActivity(
  html: string,
  pageUrl: string,
  category: string | null,
): CourseRecord & { centreName: string } {
  const $ = load(html);
  const json = $('script[type="application/ld+json"]').first().text();
  let event: { name?: unknown; location?: { name?: unknown } };
  try {
    event = JSON.parse(json);
  } catch {
    throw new Error('Tarragona activity page has no structured event data');
  }
  const rawName = typeof event.name === 'string' ? event.name : '';
  const centreName = cleanText(String(event.location?.name ?? ''));
  // The event name ends with the internal activity code, e.g. "(c2t26ac1ap)".
  const title = cleanText(
    rawName.replace(/\s*\(c\d+t\d+[a-z0-9]*\)\s*$/iu, ''),
  );
  const block = (label: string) =>
    $('.item-des')
      .filter(
        (_, el) =>
          cleanText($(el).find('.text-semibold').first().text()) === label,
      )
      .first()
      .find('p:not(.text-semibold)')
      .map((_, p) => cleanText($(p).text()))
      .get();
  const when = block('Data i hora');
  if (!title || !centreName || !when.length)
    throw new Error('Tarragona activity page structure changed');
  const [startDate, endDate] = activityDates(when[0]!);
  const times = when
    .slice(1)
    .join(' ')
    .replace(/\s*\(Europe\/Madrid\)\s*$/u, '')
    .trim();
  const slug = new URL(pageUrl).pathname.replace(/^\/(?:ca\/)?/u, '');
  const price = priceCents(block('Preu')[0] ?? '');
  return {
    centreName,
    externalId: slug,
    title,
    officialUrl: pageUrl,
    category,
    startDate,
    endDate,
    scheduleText: times || null,
    priceCents: price,
    currency: price === null ? null : 'EUR',
    availability: null,
    isCancelled: false,
    isSoldOut: false,
    courseLanguage: null,
  };
}

export function createTarragonaAdapter(
  options: FetchOptions = {},
): SourceAdapter {
  return {
    async fetchRecords(source: SourceConfig) {
      const root = new URL(source.listingUrl);
      if (source.centreCode === undefined)
        throw new Error('Tarragona source has no centre code');
      const site = createSourceFetcher(root.origin, options);
      const registration = createSourceFetcher(
        TARRAGONA_REGISTRATION_ORIGIN,
        options,
      );
      // tarragona.cat publishes a robots.txt that only restricts named agents; the
      // registration host has none. Any stricter policy blocks ingestion for review.
      assertRobotsAllowAll(
        (await site(`${root.origin}/robots.txt`, true)) ?? '',
      );
      const regRobots = await registration(
        `${TARRAGONA_REGISTRATION_ORIGIN}/robots.txt`,
        true,
      );
      if (regRobots !== null) assertRobotsAllowAll(regRobots);

      const links = (html: string, base: string) => {
        const $ = load(html);
        return $('a[href]')
          .map((_, a) => ({
            href: new URL($(a).attr('href')!, base).href,
            text: cleanText($(a).text()),
          }))
          .get();
      };
      let pages = 1;
      const index = await site(`${root.origin}${INDEX_PATH}`);
      // The newest term's course catalogue page, e.g. .../t2026/actvitats-i-cursos/...
      const catalogue = links(index!, root.origin)
        .map((l) => l.href)
        .filter((href) =>
          /\/activitats-i-cursos\/t\d{4}\/actvitats-i-cursos\/activitats-i-cursos-monografics\/?$/u.test(
            new URL(href).pathname,
          ),
        )
        .sort()
        .at(-1);
      if (!catalogue)
        throw new Error('Tarragona course catalogue page not found');
      const catalogueUrl = new URL(catalogue);
      const prefix = catalogueUrl.pathname.replace(
        /activitats-i-cursos-monografics\/?$/u,
        '',
      );
      pages++;
      const categoryPages = links((await site(catalogue))!, catalogue)
        .filter((l) => {
          const url = new URL(l.href);
          return (
            url.origin === root.origin &&
            url.pathname.startsWith(prefix) &&
            !url.pathname.endsWith('activitats-i-cursos-monografics') &&
            l.text !== ''
          );
        })
        .filter((l, i, all) => all.findIndex((o) => o.href === l.href) === i);
      if (!categoryPages.length)
        throw new Error('Tarragona catalogue has no category pages');

      const wanted = new Map<string, string | null>();
      for (const page of categoryPages) {
        if (++pages > MAX_PAGES)
          throw new Error('Tarragona catalogue exceeded the page limit');
        const html = (await site(page.href))!;
        for (const link of links(html, page.href)) {
          const url = new URL(link.href);
          if (
            url.origin !== TARRAGONA_REGISTRATION_ORIGIN ||
            !new RegExp(`-c${source.centreCode}t\\d+[a-z0-9]*$`, 'u').test(
              url.pathname,
            )
          )
            continue;
          // An activity listed under several categories keeps the first one seen.
          if (!wanted.has(url.href)) wanted.set(url.href, page.text);
        }
      }
      if (wanted.size > MAX_ACTIVITIES)
        throw new Error('Tarragona activity limit exceeded');
      const records = new Map<string, CourseRecord>();
      for (const [url, category] of wanted) {
        const { centreName, ...record } = parseTarragonaActivity(
          (await registration(url))!,
          url,
          category,
        );
        // The activity code says which centre it belongs to; the page must agree.
        if (centreName !== source.institution.name)
          throw new Error(
            `Activity ${record.externalId} belongs to ${centreName}`,
          );
        if (records.has(record.externalId))
          throw new Error(`Duplicate activity ${record.externalId}`);
        records.set(record.externalId, record);
      }
      if (!records.size && !source.mayBeEmpty)
        throw new Error('No course records fetched');
      return [...records.values()];
    },
  };
}
