import { load, type CheerioAPI } from 'cheerio';
import { cleanText } from '../normalization/values';
import { createSourceFetcher, type FetchOptions } from '../http';
import { assertRobotsAllowAll } from '../robots';
import type { CourseRecord, SourceAdapter, SourceConfig } from '../types';
import { GIRONA_ORIGIN } from '../../centres/schema';

// Girona's civic-centre network publishes its courses as one offer of the Ajuntament's
// registration system (seu.girona.cat/si). The offer page lists every activity of the
// network (code, title, group, venue, free places) and needs the session cookie set by
// the offer index; each activity's detail fragment (period, schedule, tariffs) does not.
// The offer is renamed every season, so it is found by its title.

const OFFER_TITLE = 'Cursos i tallers de la Xarxa de Centres Cívics';
const MAX_ACTIVITIES = 400;

export interface GironaListing {
  id: string;
  code: string;
  title: string;
  group: string;
  venue: string;
  freePlaces: number | null;
}

/** The newest offer of the civic-centre network on the registration index. */
export function currentOffer(html: string): string {
  const $ = load(html);
  const ids = $('.oferta a[href]')
    .filter((_, a) => cleanText($(a).text()).startsWith(OFFER_TITLE))
    .map(
      (_, a) =>
        $(a)
          .attr('href')!
          .match(/\/consulta2\/(\d+)$/u)?.[1],
    )
    .get()
    .filter((id): id is string => id !== undefined)
    .sort((a, b) => Number(a) - Number(b));
  if (!ids.length) throw new Error('Girona civic-centre offer not found');
  return ids.at(-1)!;
}

function rows($: CheerioAPI, table: ReturnType<CheerioAPI>) {
  const values = new Map<string, string>();
  table.find('tr').each((_, tr) => {
    const label = cleanText($(tr).children('th').first().text());
    // <br/> separates tariff lines.
    const cell = $(tr).children('td').first();
    cell.find('br').replaceWith('\n');
    values.set(label, cell.text());
  });
  return values;
}

export function parseGironaListing(html: string): GironaListing[] {
  const $ = load(html);
  return $('.activitat')
    .map((_, div) => {
      const table = $(div).find('table').first();
      const link = table.find('a[href*="/consulta3/"]').first();
      const id = link.attr('href')?.match(/\/consulta3\/(\d+)$/u)?.[1];
      const values = rows($, table);
      const group = cleanText(values.get('Grup / Tipus') ?? '').split(' / ')[0];
      const venue = cleanText(values.get('Equipament') ?? '');
      const places = cleanText(values.get('Places lliures') ?? '');
      const title = cleanText(table.find('tr').first().children('td').text());
      if (!id || !title || !group || !venue)
        throw new Error('Girona listing structure changed');
      return {
        id,
        code: cleanText(link.text()),
        title,
        group,
        venue,
        freePlaces: /^\d+$/u.test(places) ? Number(places) : null,
      };
    })
    .get();
}

/** Courses a centre lists: at its own venue, or elsewhere under its code prefix. */
export function belongsTo(activity: GironaListing, source: SourceConfig) {
  if (activity.venue === source.venue) return true;
  // Another civic centre's venue ("C. C. …") is that centre's source, even when it
  // shares the code prefix (Pedret's courses are coded PM, like Pont Major's).
  return (
    source.codePrefix !== undefined &&
    activity.code.startsWith(source.codePrefix) &&
    !activity.venue.startsWith('C. C. ')
  );
}

function isoDate(value: string): string {
  const [day, month, year] = value.split('/');
  return `${year}-${month}-${day}`;
}

/** Only an explicit public price; per-term and members' prices stay unknown. */
export function publicPriceCents(tariffs: string): number | null {
  for (const line of tariffs.split('\n')) {
    const match = cleanText(line).match(
      /^preu públic:\s*(\d+(?:[.,]\d{1,2})?)\s*€$/iu,
    );
    if (match) return Math.round(Number(match[1]!.replace(',', '.')) * 100);
  }
  return null;
}

export function parseGironaActivity(
  html: string,
  listing: GironaListing,
  source: SourceConfig,
): CourseRecord {
  const $ = load(html);
  const values = rows($, $('table').first());
  const venue = cleanText(values.get('Equipament') ?? '');
  const period = cleanText(values.get('Període') ?? '').match(
    /^(\d{2}\/\d{2}\/\d{4}) - (\d{2}\/\d{2}\/\d{4})$/u,
  );
  if (cleanText(values.get('Codi') ?? '') !== listing.code || !venue)
    throw new Error(`Girona activity ${listing.id} structure changed`);
  if (venue !== listing.venue)
    throw new Error(`Girona activity ${listing.id} venue mismatch`);
  const schedule = cleanText(values.get('Horari') ?? '');
  const price = publicPriceCents(values.get('Tarifes') ?? '');
  return {
    externalId: listing.id,
    title: listing.title,
    officialUrl: `${GIRONA_ORIGIN}/si/activitats/consulta3/${listing.id}`,
    category: listing.group,
    startDate: period ? isoDate(period[1]!) : null,
    endDate: period ? isoDate(period[2]!) : null,
    // Courses held away from the centre name their venue.
    scheduleText:
      [schedule, venue === source.venue ? '' : venue]
        .filter(Boolean)
        .join(' · ') || null,
    priceCents: price,
    currency: price === null ? null : 'EUR',
    availability: null,
    isCancelled: false,
    isSoldOut: listing.freePlaces === 0,
    courseLanguage: null,
  };
}

export function createGironaAdapter(options: FetchOptions = {}): SourceAdapter {
  return {
    async fetchRecords(source: SourceConfig) {
      const origin = GIRONA_ORIGIN;
      if (!source.venue) throw new Error('Girona source has no venue');
      const site = createSourceFetcher(origin, { ...options, session: true });
      // seu.girona.cat has no robots.txt; a published one is honoured.
      const robots = await site(`${origin}/robots.txt`, true);
      if (robots !== null) assertRobotsAllowAll(robots);
      const offer = currentOffer(
        (await site(`${origin}/si/activitats/consulta`))!,
      );
      const activities = parseGironaListing(
        (await site(`${origin}/si/activitats/consulta2/${offer}`))!,
      ).filter((activity) => belongsTo(activity, source));
      if (activities.length > MAX_ACTIVITIES)
        throw new Error('Girona activity limit exceeded');
      const records = new Map<string, CourseRecord>();
      for (const activity of activities) {
        const html = await site(
          `${origin}/si/activitats/consulta3/${activity.id}`,
        );
        records.set(activity.id, parseGironaActivity(html!, activity, source));
      }
      if (!records.size && !source.mayBeEmpty)
        throw new Error('No course records fetched');
      return [...records.values()];
    },
  };
}
