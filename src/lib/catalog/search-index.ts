import { z } from 'zod';
import { isLive } from './query';
import {
  geographySchema,
  locationSchema,
  type Catalog,
  type CourseListing,
  type Snapshot,
} from './types';

// The browser search downloads these files instead of querying D1, one pair per city
// (docs/adr/0010-city-sections.md). The live file is what almost every search needs;
// past editions only load for the archive view.
//
// Editions are compact tuples. Their 64-character ids were half of the compressed
// size but only break ties when sorting, so each edition gets its position in id
// order instead (the same order across both files), and centre names and slugs are
// listed once. `decodeIndexes` turns the files back into ordinary course listings.

export const SEARCH_INDEX_VERSION = 4;
export const liveIndexPath = (city: string) => `/search/${city}/live.json`;
export const archiveIndexPath = (city: string) =>
  `/search/${city}/archive.json`;

export const officialSourceSchema = z.object({
  institutionId: z.string(),
  institutionName: z.string(),
  country: z.string(),
  cityId: z.string(),
  listingUrl: z.string().regex(/^https?:\/\/\S+$/),
});
export type OfficialSource = z.infer<typeof officialSourceSchema>;

const text = z.string().nullable();
const flag = z.union([z.literal(0), z.literal(1)]);
const encodedEdition = z.tuple([
  z.number().int().nonnegative(), // position in id order
  z.string(), // title (reviewed title when there is one)
  flag, // title reviewed
  text, // raw source category
  z.number().int().nonnegative(), // index into `institutions`
  text, // start date
  text, // end date
  text, // schedule text
  z.number().int().nullable(), // price in cents
  text, // currency
  flag, // cancelled
  flag, // sold out
  text, // organiser
  z.string().regex(/^https?:\/\/\S+$/), // official URL
  z.string(), // last verified date (yyyy-MM-dd)
]);
type EncodedEdition = z.infer<typeof encodedEdition>;

export const searchIndexSchema = z.object({
  version: z.literal(SEARCH_INDEX_VERSION),
  generatedAt: z.string(),
  timeZones: z.array(z.string()),
  geography: geographySchema,
  locations: z.array(locationSchema),
  sources: z.array(officialSourceSchema),
  // id, name, slug, city id
  institutions: z.array(
    z.tuple([z.string(), z.string(), z.string(), z.string()]),
  ),
  editions: z.array(encodedEdition),
});
export type SearchIndex = z.infer<typeof searchIndexSchema>;

// Fixed width keeps string order equal to numeric order for the tie-break.
const ID_WIDTH = 7;

/**
 * One city's live and archive search files at the build date. Positions follow the id
 * order of the city's editions, so they are consistent across its two files.
 */
export function buildSearchIndexes(
  snapshot: Snapshot,
  sources: OfficialSource[],
  today: string,
  city: string,
): { live: SearchIndex; archive: SearchIndex } {
  const ordered = snapshot.editions
    .filter((edition) => edition.city_id === city)
    .toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const institutions: [string, string, string, string][] = [];
  const institutionIndex = new Map<string, number>();
  const encode = (edition: CourseListing, position: number): EncodedEdition => {
    let institution = institutionIndex.get(edition.institution_id);
    if (institution === undefined) {
      institution = institutions.length;
      institutionIndex.set(edition.institution_id, institution);
      institutions.push([
        edition.institution_id,
        edition.institution,
        edition.institution_slug,
        edition.city_id,
      ]);
    }
    return [
      position,
      edition.title,
      edition.title_reviewed,
      edition.category,
      institution,
      edition.start_date,
      edition.end_date,
      edition.schedule_text,
      edition.price_cents,
      edition.currency,
      edition.is_cancelled,
      edition.is_sold_out,
      edition.organizer,
      edition.official_url,
      edition.last_successfully_verified_at.slice(0, 10),
    ];
  };
  const live: EncodedEdition[] = [];
  const archive: EncodedEdition[] = [];
  ordered.forEach((edition, position) =>
    (isLive(edition, today) ? live : archive).push(encode(edition, position)),
  );
  const base = {
    version: SEARCH_INDEX_VERSION,
    generatedAt: snapshot.generatedAt,
    timeZones: snapshot.timeZones,
    geography: snapshot.geography,
    locations: snapshot.locations,
    sources: sources.filter((source) => source.cityId === city),
    institutions,
  } as const;
  return {
    live: { ...base, editions: live },
    archive: { ...base, editions: archive },
  };
}

function decode(
  [
    position,
    title,
    titleReviewed,
    category,
    institution,
    startDate,
    endDate,
    schedule,
    price,
    currency,
    cancelled,
    soldOut,
    organizer,
    url,
    verified,
  ]: EncodedEdition,
  institutions: SearchIndex['institutions'],
): CourseListing {
  const [id, name, slug, city] = institutions[institution] ?? ['', '', '', ''];
  return {
    id: String(position).padStart(ID_WIDTH, '0'),
    title,
    title_reviewed: titleReviewed,
    category,
    institution: name,
    institution_id: id,
    institution_slug: slug,
    city_id: city,
    start_date: startDate,
    end_date: endDate,
    schedule_text: schedule,
    price_cents: price,
    currency,
    is_cancelled: cancelled,
    is_sold_out: soldOut,
    organizer,
    official_url: url,
    last_successfully_verified_at: verified,
  };
}

/** Joins downloaded files into one catalog; an edition appears in exactly one file. */
export function decodeIndexes(indexes: SearchIndex[]): Catalog & {
  sources: OfficialSource[];
} {
  const [first] = indexes;
  if (!first) throw new Error('No search index loaded');
  return {
    timeZones: first.timeZones,
    geography: first.geography,
    locations: first.locations,
    sources: first.sources,
    editions: indexes.flatMap((index) =>
      index.editions.map((edition) => decode(edition, index.institutions)),
    ),
  };
}
