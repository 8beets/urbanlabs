import { z } from 'zod';
// The explicit attribute is required by the Worker dev runtime (workerd) and Node.
import esAlicante from '../../../data/centres/es/alicante.json' with { type: 'json' };
import esTarragona from '../../../data/centres/es/tarragona.json' with { type: 'json' };
import esBarcelona from '../../../data/centres/es/barcelona.json' with { type: 'json' };
import { centreSchema, toSourceConfig, type Centre } from './schema';
import type { CentreProfile } from './profile-schema';

// One JSON file per city at data/centres/<country>/<city>.json (lower-case ISO
// country, seeded city ID). Import new files here; a test checks that every file
// is listed and that each record belongs to its path.
export const centreFiles: Record<string, unknown[]> = {
  'es/alicante': esAlicante,
  'es/barcelona': esBarcelona,
  'es/tarragona': esTarragona,
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

export const centreProfiles: Record<string, CentreProfile> = Object.fromEntries(
  centres.map((c) => [c.id, { slug: c.slug, ...c.profile }]),
);
