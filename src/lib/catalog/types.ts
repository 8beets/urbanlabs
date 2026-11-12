import { z } from 'zod';
import type { GeographicFilters } from '../locations/geography';
import type { Audience } from '../courses/categories';

export type { GeographicFilters };

/** One published course edition as listed on cards (category is the raw source value). */
export interface CourseListing {
  id: string;
  title: string;
  title_reviewed: 0 | 1;
  category: string | null;
  institution: string;
  institution_id: string;
  institution_slug: string;
  start_date: string | null;
  end_date: string | null;
  schedule_text: string | null;
  price_cents: number | null;
  currency: string | null;
  is_cancelled: 0 | 1;
  is_sold_out: 0 | 1;
  official_url: string;
  last_successfully_verified_at: string;
}

/** Snapshot rows also carry the provenance used to order the latest additions. */
export interface SnapshotEdition extends CourseListing {
  first_seen_at: string;
  source_id: string;
  external_id: string;
}

export interface InstitutionLocation {
  institution_id: string;
  country_code: string;
  city_id: string;
  region_id: string;
}

const nullableText = z.string().nullable();
// Source links are rendered as hrefs; only web URLs may ever reach a page.
const webUrl = z.string().regex(/^https?:\/\/\S+$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const flag = z.union([z.literal(0), z.literal(1)]);

export const courseListingSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  title_reviewed: flag,
  category: nullableText,
  institution: z.string(),
  institution_id: z.string().min(1),
  institution_slug: z.string().min(1),
  start_date: isoDate.nullable(),
  end_date: isoDate.nullable(),
  schedule_text: nullableText,
  price_cents: z.number().int().nullable(),
  currency: nullableText,
  is_cancelled: flag,
  is_sold_out: flag,
  official_url: webUrl,
  last_successfully_verified_at: z.string().min(10),
});

export const snapshotEditionSchema = courseListingSchema.extend({
  first_seen_at: z.string().min(1),
  source_id: z.string().min(1),
  external_id: z.string().min(1),
});

export const locationSchema = z.object({
  institution_id: z.string().min(1),
  country_code: z.string().min(1),
  city_id: z.string().min(1),
  region_id: z.string().min(1),
});

export const geographySchema = z.object({
  countries: z.array(z.object({ code: z.string(), name: z.string() })),
  regions: z.array(
    z.object({ id: z.string(), country_code: z.string(), name: z.string() }),
  ),
  cities: z.array(
    z.object({
      id: z.string(),
      country_code: z.string(),
      region_id: z.string(),
      name: z.string(),
    }),
  ),
});

export const centreSchema = z.object({
  id: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]{1,100}$/),
  name: z.string(),
  address: z.string(),
  city: z.string(),
  country: z.string(),
  official_url: webUrl,
  description: nullableText,
  description_language: nullableText,
  phone: nullableText,
  email: nullableText,
  details_source_url: nullableText,
  details_verified_at: nullableText,
  notice: z.literal('temporary_closure').nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  coordinates_source_url: nullableText,
  coordinates_verified_at: nullableText,
});

export const mapCentreSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});

export const SNAPSHOT_VERSION = 1;

/**
 * Everything the static build reads from D1, taken in one pass so every page of a
 * build describes the same moment. Only published, already-validated fields; no
 * source payloads or personal data.
 */
export const snapshotSchema = z.object({
  version: z.literal(SNAPSHOT_VERSION),
  generatedAt: z.string().min(1),
  timeZones: z.array(z.string()),
  geography: geographySchema,
  locations: z.array(locationSchema),
  centres: z.array(centreSchema),
  map: z.object({
    mapCentres: z.array(mapCentreSchema),
    mapHasMore: z.boolean(),
  }),
  editions: z.array(snapshotEditionSchema),
});

export type Snapshot = z.infer<typeof snapshotSchema>;
export type Centre = z.infer<typeof centreSchema>;
export type CentreMapPoint = z.infer<typeof mapCentreSchema>;

/** The subset of a snapshot that discovery queries need (also the browser index). */
export interface Catalog {
  timeZones: string[];
  geography: Snapshot['geography'];
  locations: InstitutionLocation[];
  editions: CourseListing[];
}

export interface DiscoveryFilters extends GeographicFilters {
  cancellation?: '' | 'hide' | 'only';
  /** 'available' hides editions the source reports as sold out. */
  places?: '' | 'available';
  /** Lists editions that have already ended instead of the live ones. */
  archive?: boolean;
  q: string;
  page: number;
  maxPriceCents: number | null;
  startMonth?: string;
  /** A topic id, or a legacy source category from an old link. */
  category: string;
  audience?: '' | Audience;
  centre: string;
}
