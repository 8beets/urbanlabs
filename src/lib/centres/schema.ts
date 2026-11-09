import { z } from 'zod';
import { centreProfileSchema } from './profile-schema';
import type { SourceConfig } from '../ingestion/types';
import { isTimeZone } from '../time/dates';

// Registration hosts are fetched automatically, so they are allowlisted here
// (SSRF protection): adding a platform host is a reviewed code change.
export const MIRAM_HOST_SUFFIXES = ['.inscripcionscc.com', '.miram.cloud'];

const reason = z.string().min(10).max(300);

// The probe script (npm run centre:probe) leaves "TODO" markers in fields a person
// must verify, so an unfinished draft can never validate.
const reviewedText = (min: number, max: number) =>
  z
    .string()
    .min(min)
    .max(max)
    .refine((value) => !/^TODO\b/.test(value), 'Unreviewed TODO placeholder');

// Every exclusion documents why a record is outside the course directory.
const exclusionSchema = z.union([
  z.strictObject({ categoryCode: z.string().min(1).max(20), reason }),
  z.strictObject({ externalId: z.string().regex(/^\d{1,10}$/), reason }),
]);

const miramRegistrationSchema = z.strictObject({
  platform: z.literal('miram'),
  origin: z.url().refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.port === '' &&
      url.username === '' &&
      url.password === '' &&
      url.origin === value &&
      MIRAM_HOST_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix))
    );
  }, 'Miram origin must be an https origin on an approved host'),
  centreCode: z.number().int().positive(),
  // Miram activity type: AC is the course catalogue; other types are never followed.
  activityType: z.string().regex(/^[A-Z]{2}$/),
  verifiedAt: z.iso.date(),
  // The importer refuses to run if a robots.txt appears, so only "absent" is valid
  // until a different policy has been reviewed and modelled explicitly.
  robotsTxt: z.literal('absent'),
  // Maintainer assertion for seasonal centres: an empty (but well-formed) listing is a
  // normal successful run with zero editions instead of a failure needing review.
  mayBeEmpty: z.boolean().optional(),
  exclusions: z.array(exclusionSchema).optional(),
});

// Alicante's municipal "Aula Abierta" culture classes: one page per classroom.
export const ALICANTE_ORIGIN = 'https://w3.alicante.es';
const aulaAbiertaRegistrationSchema = z.strictObject({
  platform: z.literal('alicante-aula-abierta'),
  origin: z.literal(ALICANTE_ORIGIN),
  // Classroom code used by the source's `aula` filter.
  aulaCode: z.number().int().positive(),
  verifiedAt: z.iso.date(),
  robotsTxt: z.literal('absent'),
  mayBeEmpty: z.boolean().optional(),
});

// Add new platforms as further members of this union, each with its own adapter
// (src/lib/ingestion/adapters) and a case in toSourceConfig.
export const registrationSchema = z.discriminatedUnion('platform', [
  miramRegistrationSchema,
  aulaAbiertaRegistrationSchema,
]);

export const centreSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]{3,100}$/),
  slug: centreProfileSchema.shape.slug,
  name: reviewedText(3, 200),
  officialUrl: z.url().startsWith('https://'),
  address: reviewedText(5, 300),
  country: z.string().regex(/^[A-Z]{2}$/),
  city: z.string().min(1).max(100),
  cityId: z.string().regex(/^[a-z0-9-]{1,100}$/),
  // IANA zone of the centre; editions use it for local dates and daylight saving.
  timezone: z.string().refine(isTimeZone, 'Unknown IANA time zone'),
  profile: centreProfileSchema.omit({ slug: true }).default({}),
  // A paused centre stays validated in the registry but is never ingested or
  // published, e.g. while permission to reuse its source is pending.
  pausedReason: z.string().min(20).max(500).optional(),
  registration: registrationSchema,
});
export type Centre = z.infer<typeof centreSchema>;

export function miramListingUrl(
  registration: Extract<Centre['registration'], { platform: 'miram' }>,
): string {
  return `${registration.origin}/MiramModular/buscador/buscador.jsp?g=1&c=${registration.centreCode}&t=${registration.activityType}`;
}

export function aulaAbiertaListingUrl(
  registration: Extract<
    Centre['registration'],
    { platform: 'alicante-aula-abierta' }
  >,
): string {
  return `${registration.origin}/cultura/aula-abierta/consulta-cursos.php?aula=${registration.aulaCode}`;
}

export function toSourceConfig(centre: Centre): SourceConfig {
  const exclusions =
    'exclusions' in centre.registration
      ? (centre.registration.exclusions ?? [])
      : [];
  const categories = exclusions.flatMap((e) =>
    'categoryCode' in e ? [e.categoryCode] : [],
  );
  const records = exclusions.flatMap((e) =>
    'externalId' in e ? [e.externalId] : [],
  );
  return {
    id: `${centre.registration.platform}-${centre.slug}`,
    platform: centre.registration.platform,
    ...(centre.registration.platform === 'miram'
      ? {
          name: `${centre.name} · Miram`,
          listingUrl: miramListingUrl(centre.registration),
        }
      : {
          name: `${centre.name} · Aula Abierta`,
          listingUrl: aulaAbiertaListingUrl(centre.registration),
        }),
    ...(categories.length ? { excludedCategoryCodes: categories } : {}),
    ...(records.length ? { excludedExternalIds: records } : {}),
    ...(centre.registration.mayBeEmpty ? { mayBeEmpty: true } : {}),
    institution: {
      id: centre.id,
      name: centre.name,
      url: centre.officialUrl,
      city: centre.city,
      cityId: centre.cityId,
      country: centre.country,
      address: centre.address,
      timezone: centre.timezone,
    },
  };
}
