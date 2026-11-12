import { z } from 'zod';
// The explicit attribute is required by the Worker dev runtime (workerd) and Node.
import data from '../../../data/geography.json' with { type: 'json' };

// Reviewed countries, regions and cities (data/geography.json). Ingestion writes the
// rows a source needs, so adding a city needs no migration (ADR 0010).

const id = z.string().regex(/^[a-z0-9-]{1,100}$/);
const country = z.string().regex(/^[A-Z]{2}$/);
const name = z.string().trim().min(1).max(100);
const names = z.strictObject({ es: name, ca: name });

const geographySchema = z
  .strictObject({
    countries: z.array(z.strictObject({ code: country, name })),
    regions: z.array(z.strictObject({ id, country, name })),
    cities: z.array(
      z.strictObject({
        id,
        country,
        region: id,
        names,
        /** Attribution the city's data licence asks for, shown in the footer. */
        dataCredit: z
          .strictObject({ url: z.url({ protocol: /^https$/ }), names })
          .optional(),
      }),
    ),
  })
  .superRefine((geo, ctx) => {
    const countries = new Set(geo.countries.map((row) => row.code));
    const regions = new Map(geo.regions.map((row) => [row.id, row.country]));
    for (const ids of [
      geo.countries.map((row) => row.code),
      geo.regions.map((row) => row.id),
      geo.cities.map((row) => row.id),
    ])
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({ code: 'custom', message: 'Duplicate geography id' });
    for (const region of geo.regions)
      if (!countries.has(region.country))
        ctx.addIssue({
          code: 'custom',
          message: `Unknown country: ${region.id}`,
        });
    for (const city of geo.cities)
      if (regions.get(city.region) !== city.country)
        ctx.addIssue({ code: 'custom', message: `Unknown region: ${city.id}` });
  });

// Fail at import time, like the centre registry.
export const geography = geographySchema.parse(data);
export type GeographyCity = (typeof geography.cities)[number];

const cities = new Map(geography.cities.map((city) => [city.id, city]));
export const geographyCity = (cityId: string): GeographyCity | undefined =>
  cities.get(cityId);

/** The country, region and city rows a centre in this city needs, or null if unknown. */
export function cityRows(cityId: string) {
  const city = cities.get(cityId);
  if (!city) return null;
  return {
    country: geography.countries.find((row) => row.code === city.country)!,
    region: geography.regions.find((row) => row.id === city.region)!,
    city,
  };
}
