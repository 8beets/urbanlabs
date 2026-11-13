import { z } from 'zod';
// The explicit attribute is required by the Worker dev runtime (workerd) and Node.
import esAlicante from '../../../data/centres/es/alicante.json' with { type: 'json' };
import esTarragona from '../../../data/centres/es/tarragona.json' with { type: 'json' };
import esBarcelona from '../../../data/centres/es/barcelona.json' with { type: 'json' };
import esZaragoza from '../../../data/centres/es/zaragoza.json' with { type: 'json' };
import esGirona from '../../../data/centres/es/girona.json' with { type: 'json' };
import esVitoriaGasteiz from '../../../data/centres/es/vitoria-gasteiz.json' with { type: 'json' };
import { centreSchema, toSourceConfig, type Centre } from './schema';
import type { CentreProfile } from './profile-schema';
import { geographyCity } from '../locations/registry';

// One JSON file per city at data/centres/<country>/<city>.json (lower-case ISO
// country, seeded city ID). Import new files here; a test checks that every file
// is listed and that each record belongs to its path.
export const centreFiles: Record<string, unknown[]> = {
  'es/alicante': esAlicante,
  'es/barcelona': esBarcelona,
  'es/girona': esGirona,
  'es/tarragona': esTarragona,
  'es/vitoria-gasteiz': esVitoriaGasteiz,
  'es/zaragoza': esZaragoza,
};
const records = Object.values(centreFiles).flat();

function unique(values: string[], label: string) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Duplicate centre ${label}: ${value}`);
    seen.add(value);
  }
}

// Fail at import time: an invalid registry must never reach ingestion or the Worker.
export const centres: Centre[] = z.array(centreSchema).parse(records);
unique(
  centres.map((c) => c.id),
  'id',
);
unique(
  centres.map((c) => c.slug),
  'slug',
);
unique(
  centres.map((c) => toSourceConfig(c).id),
  'source id',
);
unique(
  centres.map((c) => toSourceConfig(c).listingUrl),
  'listing URL',
);

for (const centre of centres)
  if (geographyCity(centre.cityId)?.country !== centre.country)
    throw new Error(
      `Centre ${centre.id} is in ${centre.country}/${centre.cityId}, which data/geography.json does not list`,
    );

export const centreProfiles: Record<string, CentreProfile> = Object.fromEntries(
  centres.map((c) => [c.id, { slug: c.slug, ...c.profile }]),
);
