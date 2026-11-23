import { compareArchive, compareLive, isLive } from './query';
import type { Catalog, CourseListing, Snapshot } from './types';
// Type-only, so zod stays out of the browser bundle.
import type {
  DetailChunk,
  EncodedDetails,
  EncodedEdition,
  OfficialSource,
  SearchIndex,
} from './search-index-schema';

export type { DetailChunk, OfficialSource, SearchIndex };

// The browser search downloads these files instead of querying D1, one set per city
// (docs/adr/0010-city-sections.md, docs/adr/0013-split-search-index.md):
// - live.json: every live edition with only what filtering and sorting need. Almost
//   every search reads it, so it carries the size budget.
// - archive.json: the same for ended editions, loaded only for the archive view.
// - details/<n>.json: what only a card shows (schedule, source link, organiser,
//   verification date…), DETAIL_CHUNK_SIZE editions per file, loaded for the cards
//   on screen.
//
// Editions are compact tuples. Their 64-character ids only break ties when sorting,
// so each edition gets a position instead: live editions first in default listing
// order, then ended ones in archive order. Position order keeps every tie-break of
// the id order, and it puts the first pages of an unfiltered search in one detail
// file. Centre names and slugs are listed once. `decodeIndexes` and `withDetails` turn
// the files back into ordinary course listings.

export const SEARCH_INDEX_VERSION = 5;
export const DETAIL_CHUNK_SIZE = 100;
export const liveIndexPath = (city: string) => `/search/${city}/live.json`;
export const archiveIndexPath = (city: string) =>
  `/search/${city}/archive.json`;
export const detailChunkPath = (city: string, chunk: number) =>
  `/search/${city}/details/${chunk}.json`;

// Fixed width keeps string order equal to numeric order for the tie-break.
const ID_WIDTH = 7;

export interface CitySearchFiles {
  live: SearchIndex;
  archive: SearchIndex;
  details: DetailChunk[];
}

/** One city's search files at the build date. */
export function buildSearchIndexes(
  snapshot: Snapshot,
  sources: OfficialSource[],
  today: string,
  city: string,
): CitySearchFiles {
  const editions = snapshot.editions.filter(
    (edition) => edition.city_id === city,
  );
  const ordered = [
    ...editions
      .filter((edition) => isLive(edition, today))
      .toSorted(compareLive),
    ...editions
      .filter((edition) => !isLive(edition, today))
      .toSorted(compareArchive),
  ];
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
      edition.category,
      institution,
      edition.start_date,
      edition.end_date,
      edition.price_cents,
      edition.is_cancelled,
      edition.is_sold_out,
    ];
  };
  const details = (edition: CourseListing): EncodedDetails => [
    edition.title_reviewed,
    edition.schedule_text,
    edition.currency,
    edition.organizer,
    edition.official_url,
    edition.last_successfully_verified_at.slice(0, 10),
  ];
  const live: EncodedEdition[] = [];
  const archive: EncodedEdition[] = [];
  ordered.forEach((edition, position) =>
    (isLive(edition, today) ? live : archive).push(encode(edition, position)),
  );
  // Only the city's own rows: its search never filters by another place.
  const locations = snapshot.locations.filter((row) => row.city_id === city);
  const cityRow = snapshot.geography.cities.filter((row) => row.id === city);
  const geography = {
    countries: snapshot.geography.countries.filter((row) =>
      cityRow.some((c) => c.country_code === row.code),
    ),
    regions: snapshot.geography.regions.filter((row) =>
      cityRow.some((c) => c.region_id === row.id),
    ),
    cities: cityRow,
  };
  const base = {
    version: SEARCH_INDEX_VERSION,
    generatedAt: snapshot.generatedAt,
    timeZones: snapshot.timeZones,
    geography,
    locations,
    sources: sources.filter((source) => source.cityId === city),
    institutions,
  } as const;
  const chunks: DetailChunk[] = [];
  for (let start = 0; start < ordered.length; start += DETAIL_CHUNK_SIZE)
    chunks.push({
      version: SEARCH_INDEX_VERSION,
      generatedAt: snapshot.generatedAt,
      editions: ordered.slice(start, start + DETAIL_CHUNK_SIZE).map(details),
    });
  return {
    live: { ...base, editions: live },
    archive: { ...base, editions: archive },
    details: chunks,
  };
}

function decode(
  [
    position,
    title,
    category,
    institution,
    startDate,
    endDate,
    price,
    cancelled,
    soldOut,
  ]: EncodedEdition,
  institutions: SearchIndex['institutions'],
): CourseListing {
  const [id, name, slug, city] = institutions[institution] ?? ['', '', '', ''];
  return {
    id: String(position).padStart(ID_WIDTH, '0'),
    title,
    category,
    institution: name,
    institution_id: id,
    institution_slug: slug,
    city_id: city,
    start_date: startDate,
    end_date: endDate,
    price_cents: price,
    is_cancelled: cancelled,
    is_sold_out: soldOut,
    // Card details arrive with `withDetails` for the editions shown.
    title_reviewed: 0,
    schedule_text: null,
    currency: null,
    organizer: null,
    official_url: '',
    last_successfully_verified_at: '',
  };
}

/**
 * Joins downloaded files into one catalog for filtering; an edition appears in exactly
 * one file. Its card details are empty until `withDetails` fills them.
 */
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

/** The detail files that hold these decoded editions, in ascending order. */
export function detailChunksFor(
  courses: Pick<CourseListing, 'id'>[],
): number[] {
  return [
    ...new Set(
      courses.map((course) =>
        Math.floor(Number(course.id) / DETAIL_CHUNK_SIZE),
      ),
    ),
  ].sort((a, b) => a - b);
}

/** A decoded edition with its card details from the loaded detail files. */
export function withDetails<T extends CourseListing>(
  course: T,
  chunks: ReadonlyMap<number, DetailChunk>,
): T {
  const position = Number(course.id);
  const details = chunks.get(Math.floor(position / DETAIL_CHUNK_SIZE))
    ?.editions[position % DETAIL_CHUNK_SIZE];
  if (!details) throw new Error(`Search details missing for ${course.id}`);
  const [reviewed, schedule, currency, organizer, url, verified] = details;
  return {
    ...course,
    title_reviewed: reviewed,
    schedule_text: schedule,
    currency,
    organizer,
    official_url: url,
    last_successfully_verified_at: verified,
  };
}
