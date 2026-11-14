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
export type EncodedEdition = z.infer<typeof encodedEdition>;

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
