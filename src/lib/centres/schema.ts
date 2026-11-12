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

// Tarragona's municipal civic-centre network: programme pages on www.tarragona.cat
// linking to activity pages on inscripcions.tarragona.cat (fixed in the adapter).
export const TARRAGONA_ORIGIN = 'https://www.tarragona.cat';
const tarragonaRegistrationSchema = z.strictObject({
  platform: z.literal('tarragona-centres-civics'),
  origin: z.literal(TARRAGONA_ORIGIN),
  // The "c<N>" number in the network's activity codes, e.g. c2t26ac1ap is centre 2.
  centreCode: z.number().int().min(1).max(99),
  // The centre's own page on the network site; it is the source's listing URL.
  centrePage: z
    .string()
    .regex(/^\/centrescivics\/centres-civics\/[a-z0-9-]+\/[a-z0-9-]+$/),
  verifiedAt: z.iso.date(),
  // Reviewed policy: the `User-agent: *` group has an empty Disallow (named agents are
  // restricted separately). The adapter re-checks this on every run.
  robotsTxt: z.literal('allows-all'),
  mayBeEmpty: z.boolean().optional(),
});

// Zaragoza's municipal civic centres: the city's public events API (fixed paths in the
// adapter), one listing per centre.
export const ZARAGOZA_ORIGIN = 'https://www.zaragoza.es';
const zaragozaRegistrationSchema = z.strictObject({
  platform: z.literal('zaragoza-centros-civicos'),
  origin: z.literal(ZARAGOZA_ORIGIN),
  // The centre's facility id, which the events API uses as `idLugar`.
  placeId: z.number().int().positive(),
  verifiedAt: z.iso.date(),
  // Reviewed policy: the `User-agent: *` group disallows other paths (e.g. /api/,
  // *.csv) but not the JSON paths the adapter requests; it re-checks them every run.
  robotsTxt: z.literal('allows-requested-paths'),
  mayBeEmpty: z.boolean().optional(),
});

// Add new platforms as further members of this union, each with its own adapter
// (src/lib/ingestion/adapters) and a case in toSourceConfig.
export const registrationSchema = z.discriminatedUnion('platform', [
  miramRegistrationSchema,
  aulaAbiertaRegistrationSchema,
  tarragonaRegistrationSchema,
  zaragozaRegistrationSchema,
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

function platformSource(
  centre: Centre,
  registration: Centre['registration'],
): Pick<SourceConfig, 'name' | 'listingUrl' | 'centreCode'> {
  switch (registration.platform) {
    case 'miram':
      return {
        name: `${centre.name} · Miram`,
        listingUrl: miramListingUrl(registration),
      };
    case 'alicante-aula-abierta':
      return {
        name: `${centre.name} · Aula Abierta`,
        listingUrl: aulaAbiertaListingUrl(registration),
      };
    case 'tarragona-centres-civics':
      return {
        name: `${centre.name} · Centres Cívics de Tarragona`,
        listingUrl: `${registration.origin}${registration.centrePage}`,
        centreCode: registration.centreCode,
      };
    case 'zaragoza-centros-civicos':
      return {
        name: `${centre.name} · Centros Cívicos de Zaragoza`,
        // The centre's public activity listing; the adapter reads its `idLugar`.
        listingUrl: `${registration.origin}/sede/servicio/cultura/evento/list?idLugar=${registration.placeId}`,
      };
  }
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
    ...platformSource(centre, centre.registration),
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
