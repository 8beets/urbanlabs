import { z } from 'zod';
import { SEARCH_INDEX_VERSION } from './search-index';
import { geographySchema, locationSchema } from './types';

// Kept apart from search-index.ts, which the browser loads: zod would add ~70 KB there.

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
// What filtering and sorting need; positions follow listing order (see search-index.ts).
const encodedEdition = z.tuple([
  z.number().int().nonnegative(), // position
  z.string(), // title (reviewed title when there is one)
  text, // raw source category
  z.number().int().nonnegative(), // index into `institutions`
  text, // start date
  text, // end date
  z.number().int().nullable(), // price in cents
  flag, // cancelled
  flag, // sold out
]);
export type EncodedEdition = z.infer<typeof encodedEdition>;

// What only a rendered card needs, loaded for the editions on screen.
const encodedDetails = z.tuple([
  flag, // title reviewed
  text, // schedule text
  text, // currency
  text, // organiser
  z.string().regex(/^https?:\/\/\S+$/), // official URL
  z.string(), // last verified date (yyyy-MM-dd)
]);
export type EncodedDetails = z.infer<typeof encodedDetails>;

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

/** Card details of positions `chunk * DETAIL_CHUNK_SIZE` onwards, in position order. */
export const detailChunkSchema = z.object({
  version: z.literal(SEARCH_INDEX_VERSION),
  generatedAt: z.string(),
  editions: z.array(encodedDetails),
});
export type DetailChunk = z.infer<typeof detailChunkSchema>;
