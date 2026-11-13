import { load } from 'cheerio';
import { cleanText, parseDateRange } from '../normalization/values';
import { createSourceFetcher, type FetchOptions } from '../http';
import { assertRobotsAllowPath } from '../robots';
import { SABADELL_ORIGIN } from '../../centres/schema';
import type { CourseRecord, SourceAdapter, SourceConfig } from '../types';

// Sabadell publishes the long-running courses and workshops of its civic centres as one
// Joomla blog on web.sabadell.cat ("Cursos i tallers", 10 per page). The cards do not
// name the centre, so the whole catalogue (listing plus one article per activity) is
// read once per process and shared by the centres' sources, each keeping the articles
// whose venue ("Lloc") is its directory entry. The article id is stable and is the
// external id. Prices are not published (many courses are run by local entities), so
// they stay unknown and the organiser is kept instead. Descriptions are not imported.

const LISTING =
  '/activitats-subhome/activitats-llarga-durada-als-centres-civics-cursos-i-tallers';
const PAGE_SIZE = 10;
const MAX_PAGES = 80;
// The catalogue is shared by every centre's source within one run.
const CACHE_MS = 60 * 60 * 1000;

export interface SabadellActivity {
  id: string;
  title: string;
  venueCode: number | null;
  startDate: string | null;
  endDate: string | null;
  scheduleText: string | null;
  organizer: string | null;
}

/** Article links on one listing page, as `{ id, path }`. */
export function parseSabadellListing(
  html: string,
): { id: string; path: string }[] {
  const $ = load(html);
  const seen = new Map<string, string>();
  $('[itemprop="blogPost"] h2 a[href]').each((_, a) => {
    const url = new URL($(a).attr('href')!, SABADELL_ORIGIN);
    const id = url.searchParams.get('id');
    if (
      url.origin !== SABADELL_ORIGIN ||
      url.searchParams.get('view') !== 'article' ||
      !id ||
      !/^\d+$/.test(id)
    )
      throw new Error(`Unexpected Sabadell article link: ${url.href}`);
    if (!seen.has(id)) seen.set(id, url.pathname + url.search);
  });
  return [...seen].map(([id, path]) => ({ id, path }));
}

/** "De dilluns 14 de setembre de 2026 a divendres 23 de juliol de 2027". */
export function sabadellDates(text: string): {
  startDate: string | null;
  endDate: string | null;
} {
  const [startDate, endDate] = parseDateRange(text);
  return { startDate, endDate };
}

export function parseSabadellActivity(
  html: string,
  id: string,
): SabadellActivity {
  const $ = load(html);
  const title = cleanText($('h1.titol-article').first().text());
  if (!title) throw new Error(`Sabadell article ${id} has no title`);
  const when = $('.agenda010').first();
  const lines = when
    .find('p')
    .map((_, p) => cleanText($(p).text()))
    .get();
  const venue = $('a[href*="fitxes-repertori"][href*="view=article"]')
    .first()
    .attr('href')
    ?.match(/[?&]id=(\d+)/u)?.[1];
  const organizer = cleanText(
    $('div')
      .filter((_, div) => cleanText($(div).text()) === 'Organitza:')
      .first()
      .next('a')
      .text(),
  ).replace(/\.$/u, '');
  const schedule = lines
    .find((line) => line.startsWith('Horari:'))
    ?.replace(/^Horari:\s*/u, '');
  return {
    id,
    title,
    venueCode: venue ? Number(venue) : null,
    ...sabadellDates(lines[0] ?? ''),
    scheduleText: schedule || null,
    organizer: organizer.slice(0, 200) || null,
  };
}

export function sabadellRecord(activity: SabadellActivity): CourseRecord {
  return {
    externalId: activity.id,
    title: activity.title,
    officialUrl: `${SABADELL_ORIGIN}/index.php?option=com_content&view=article&id=${activity.id}`,
    category: null,
    startDate: activity.startDate,
    endDate: activity.endDate,
    scheduleText: activity.scheduleText,
    priceCents: null,
    currency: null,
    availability: null,
    isCancelled: false,
    isSoldOut: false,
    organizer: activity.organizer,
    courseLanguage: null,
  };
}

async function readCatalogue(
  site: (url: string, allowNotFound?: boolean) => Promise<string | null>,
): Promise<SabadellActivity[]> {
  // web.sabadell.cat has no robots.txt (404); a published one is honoured.
  const robots = await site(`${SABADELL_ORIGIN}/robots.txt`, true);
  if (robots !== null) assertRobotsAllowPath(robots, `${LISTING}?start=10`);
  const articles = new Map<string, string>();
  for (let page = 0; ; page++) {
    if (page >= MAX_PAGES)
      throw new Error('Sabadell listing page limit exceeded');
    const start = page * PAGE_SIZE;
    const found = parseSabadellListing(
      (await site(
        `${SABADELL_ORIGIN}${LISTING}${start ? `?start=${start}` : ''}`,
      ))!,
    );
    const before = articles.size;
    for (const { id, path } of found)
      if (!articles.has(id)) articles.set(id, path);
    // Past the last page Joomla repeats the last one or shows none.
    if (!found.length || articles.size === before) break;
  }
  const activities: SabadellActivity[] = [];
  for (const [id, path] of articles)
    activities.push(
      parseSabadellActivity((await site(`${SABADELL_ORIGIN}${path}`))!, id),
    );
  return activities;
}

let shared: { at: number; catalogue: Promise<SabadellActivity[]> } | null =
  null;

function catalogueFor(options: FetchOptions): Promise<SabadellActivity[]> {
  const read = () =>
    readCatalogue(createSourceFetcher(SABADELL_ORIGIN, options));
  // Injected fetchers (tests) never share the cached catalogue.
  if (options.fetch) return read();
  if (!shared || Date.now() - shared.at > CACHE_MS) {
    const catalogue = read();
    shared = { at: Date.now(), catalogue };
    // A failed read must not be reused by the next source.
    catalogue.catch(() => {
      if (shared?.catalogue === catalogue) shared = null;
    });
  }
  return shared.catalogue;
}

export function createSabadellAdapter(
  options: FetchOptions = {},
): SourceAdapter {
  return {
    async fetchRecords(source: SourceConfig) {
      if (!source.centreCode)
        throw new Error('Sabadell source has no venue code');
      const records = (await catalogueFor(options))
        .filter((activity) => activity.venueCode === source.centreCode)
        .map(sabadellRecord);
      if (!records.length && !source.mayBeEmpty)
        throw new Error('No course records fetched');
      return records;
    },
  };
}
