import { z } from 'zod';
import { parseCsv } from '../ingestion/normalization/csv';
import { geographyCity } from '../locations/registry';
import {
  centreSchema,
  OPEN_DATA_ORIGIN,
  openDataFileUrl,
  type Centre,
} from './schema';

// Centres maintained by hand in 8beets/urban-open-courses-data (<folder>/centres.csv)
// become reviewed registry records through `npm run open-data:centres`, which prints
// drafts for data/centres/<country>/<city>.json (ADR 0004: the registry stays reviewed).

export const CENTRE_COLUMNS = [
  'id',
  'name',
  'address',
  'official_url',
  'latitude',
  'longitude',
] as const;
export const OPTIONAL_CENTRE_COLUMNS = ['phone', 'email'] as const;
type Column =
  (typeof CENTRE_COLUMNS)[number] | (typeof OPTIONAL_CENTRE_COLUMNS)[number];

// The only country so far; another needs its zone here (and a review of local DST).
const COUNTRY_TIME_ZONES: Record<string, string> = { es: 'Europe/Madrid' };

const coordinate = (min: number, max: number) =>
  z
    .string()
    .regex(/^-?\d{1,3}\.\d{4,}$/, 'decimal degrees with at least 4 decimals')
    .transform(Number)
    .pipe(z.number().min(min).max(max));

const centreRowSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,100}$/, 'lower-case id'),
  name: z.string().min(3).max(200),
  address: z.string().min(5).max(300),
  official_url: z
    .url()
    .refine((value) => value.startsWith('https://'), 'must be https'),
  latitude: coordinate(-90, 90),
  longitude: coordinate(-180, 180),
  phone: z.union([z.literal(''), z.string().regex(/^[+0-9 ()-]{5,30}$/)]),
  email: z.union([z.literal(''), z.email()]),
});
export type OpenDataCentre = z.infer<typeof centreRowSchema>;

/** The validated rows of a centres.csv; throws naming the row and column. */
export function openDataCentres(csv: string): OpenDataCentre[] {
  const [header, ...lines] = parseCsv(csv, ',');
  const columns = (header ?? []).map((name) => name.trim());
  for (const column of CENTRE_COLUMNS)
    if (!columns.includes(column))
      throw new Error(`centres.csv lacks column ${column}`);
  const centres = lines.flatMap((line, index) => {
    if (!line.some((value) => value.trim())) return [];
    const row = index + 2;
    if (line.length !== columns.length)
      throw new Error(`centres.csv row ${row} has the wrong number of fields`);
    const values = Object.fromEntries(
      [...CENTRE_COLUMNS, ...OPTIONAL_CENTRE_COLUMNS].map((column: Column) => {
        const i = columns.indexOf(column);
        return [column, i < 0 ? '' : line[i]!.trim()];
      }),
    );
    const parsed = centreRowSchema.safeParse(values);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      throw new Error(
        `centres.csv row ${row}, ${String(issue.path[0] ?? 'row')}: ${issue.message}`,
      );
    }
    return [parsed.data];
  });
  const ids = centres.map((centre) => centre.id);
  if (new Set(ids).size !== ids.length)
    throw new Error('centres.csv repeats a centre id');
  return centres;
}

const slugify = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);

/**
 * A draft registry record for one centre of a city folder. The slug is derived from the
 * name and the profile points back to the data file; a person still reviews both.
 */
export function draftOpenDataCentre(
  centre: OpenDataCentre,
  folder: string,
  today: string,
): Centre {
  const [country, , cityId] = folder.split('/') as [string, string, string];
  const city = geographyCity(cityId);
  if (!city || city.country.toLowerCase() !== country)
    throw new Error(
      `${folder} is not a city in data/geography.json; add the city there first`,
    );
  const timezone = COUNTRY_TIME_ZONES[country];
  if (!timezone) throw new Error(`No time zone configured for ${country}`);
  const sourceUrl = openDataFileUrl(folder, 'centres.csv');
  return centreSchema.parse({
    id: `od-${cityId}-${centre.id}`,
    slug: slugify(centre.name),
    name: centre.name,
    officialUrl: centre.official_url,
    address: centre.address,
    country: city.country,
    city: city.names.es,
    cityId,
    timezone,
    profile: {
      ...(centre.phone ? { phone: centre.phone } : {}),
      ...(centre.email ? { email: centre.email } : {}),
      detailsSourceUrl: sourceUrl,
      detailsVerifiedAt: today,
      location: {
        latitude: centre.latitude,
        longitude: centre.longitude,
        sourceUrl,
        verifiedAt: today,
      },
    },
    registration: {
      platform: 'open-courses-data',
      origin: OPEN_DATA_ORIGIN,
      folder,
      centreId: centre.id,
      verifiedAt: today,
      robotsTxt: 'absent',
      // Courses are added by hand and may lag behind a newly listed centre.
      mayBeEmpty: true,
    },
  });
}
