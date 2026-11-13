import { load } from 'cheerio';
import {
  catalanMonthNumber,
  cleanText,
  euroCents,
  localDate,
} from '../normalization/values';
import { createSourceFetcher, type FetchOptions } from '../http';
import { assertRobotsAllowPath } from '../robots';
import { REUS_ORIGIN } from '../../centres/schema';
import type { CourseRecord, SourceAdapter, SourceConfig } from '../types';

// Reus's civic-centre network publishes its courses, workshops and talks on the city's
// registration platform (inscripcions.reus.cat, the same "inscribirme" platform as
// Tarragona's but another page template). The listing filtered to the Centres Cívics
// department (`depart=6`) is paged and each card names the centre; only the source
// centre's activity pages are read. The page slug is the stable external id.

const LISTING = (page: number) =>
  `/?page=${page}&depart=6&activitat=&categoria=&edat=&tema=`;
const MAX_PAGES = 30;
const MAX_ACTIVITIES = 300;

/** Cards on one listing page, as `{ slug, venue }`, and whether a next page exists. */
export function parseReusListing(html: string): {
  cards: { slug: string; venue: string }[];
  hasNext: boolean;
} {
  const $ = load(html);
  const cards = $('a.inscribirme_event')
    .map((_, a) => {
      const href = $(a).attr('href') ?? '';
      if (!/^\/[a-z0-9]+$/u.test(href))
        throw new Error(`Unexpected Reus activity link: ${href}`);
      const venue = cleanText(
        $(a).find('img[src$="location.png"]').parent().text(),
      ).replace(/,\s*Reus$/u, '');
      return { slug: href.slice(1), venue };
    })
    .get();
  return { cards, hasNext: $('a[aria-label="Next"]').length > 0 };
}

function reusDates(line: string): [string | null, string | null] {
  const dates = [...line.matchAll(/(\d{1,2})\s+(\p{L}+)\s+(\d{4})/gu)].map(
    (m) => localDate(m[1]!, catalanMonthNumber(m[2]!), m[3]!),
  );
  if (dates.length === 1) return [dates[0]!, dates[0]!];
  if (dates.length === 2) return [dates[0]!, dates[1]!];
  return [null, null];
}

export function reusPriceCents(lines: string[]): number | null {
  if (lines.length !== 1) return null;
  if (/^gratu[ïi]ta?$/iu.test(lines[0]!)) return 0;
  const match = lines[0]!.match(/^(\d+(?:[.,]\d{1,2})?)\s*€$/u);
  return match ? euroCents(match[1]!) : null;
}

interface ReusEvent {
  name?: unknown;
  eventStatus?: unknown;
  location?: { name?: unknown };
  offers?: { availability?: unknown }[];
}

/** One activity page: schema.org Event plus the visible "Data i Hora" and "Preu" blocks. */
export function parseReusActivity(
  html: string,
  slug: string,
): CourseRecord & { venue: string } {
  const $ = load(html);
  let event: ReusEvent;
  try {
    event = JSON.parse($('script[type="application/ld+json"]').first().text());
  } catch {
    throw new Error(`Reus activity ${slug} has no structured event data`);
  }
  // Titles often end with the centre, e.g. "CUINA PER SOLTERS – CC MIGJORN".
  const title = cleanText(String(event.name ?? '')).replace(
    /\s+[-–]\s+CC\s+[^-–]+$/u,
    '',
  );
  const venue = cleanText(String(event.location?.name ?? ''));
  const blocks = new Map<string, string[]>();
  let label: string | null = null;
  $('.info p').each((_, p) => {
    const text = cleanText($(p).text());
    if (/font-weight:\s*bold/u.test($(p).attr('style') ?? '')) {
      label = text;
      blocks.set(text, []);
    } else if (label && text) blocks.get(label)!.push(text);
  });
  const when = blocks.get('Data i Hora') ?? [];
  if (!title || !venue || !when.length)
    throw new Error(`Reus activity ${slug} page structure changed`);
  const [startDate, endDate] = reusDates(when[0]!);
  const price = reusPriceCents(blocks.get('Preu') ?? []);
  const offers = Array.isArray(event.offers) ? event.offers : [];
  return {
    venue,
    externalId: slug,
    title,
    officialUrl: `${REUS_ORIGIN}/${slug}`,
    category: null,
    startDate,
    endDate,
    scheduleText: when.slice(1).join(' ') || null,
    priceCents: price,
    currency: price === null ? null : 'EUR',
    availability: null,
    isCancelled: event.eventStatus === 'https://schema.org/EventCancelled',
    isSoldOut:
      offers.length > 0 &&
      offers.every((o) => o.availability === 'https://schema.org/SoldOut'),
    courseLanguage: null,
  };
}

export function createReusAdapter(options: FetchOptions = {}): SourceAdapter {
  return {
    async fetchRecords(source: SourceConfig) {
      if (!source.venue) throw new Error('Reus source has no venue');
      const site = createSourceFetcher(REUS_ORIGIN, options);
      const robots = await site(`${REUS_ORIGIN}/robots.txt`, true);
      if (robots !== null) assertRobotsAllowPath(robots, LISTING(2));
      const slugs = new Set<string>();
      for (let page = 1; ; page++) {
        if (page > MAX_PAGES)
          throw new Error('Reus listing exceeded the page limit');
        const { cards, hasNext } = parseReusListing(
          (await site(`${REUS_ORIGIN}${LISTING(page)}`))!,
        );
        for (const card of cards)
          if (card.venue === source.venue) slugs.add(card.slug);
        if (!hasNext) break;
      }
      if (slugs.size > MAX_ACTIVITIES)
        throw new Error('Reus activity limit exceeded');
      const records: CourseRecord[] = [];
      for (const slug of slugs) {
        if (robots !== null) assertRobotsAllowPath(robots, `/${slug}`);
        const { venue, ...record } = parseReusActivity(
          (await site(`${REUS_ORIGIN}/${slug}`))!,
          slug,
        );
        // The card said this centre; the activity page must agree.
        if (venue !== source.venue)
          throw new Error(`Reus activity ${slug} is at ${venue}`);
        records.push(record);
      }
      if (!records.length && !source.mayBeEmpty)
        throw new Error('No course records fetched');
      return records;
    },
  };
}
