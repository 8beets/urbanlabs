import { z } from 'zod';
import { geographySchema } from '../catalog/types';

/**
 * The categories and cities the alert form offers, prerendered from the catalogue
 * snapshot like every other page. The alert pages read this asset instead of D1.
 */
export const ALERT_OPTIONS_PATH = '/alerts/options.json';

export const alertOptionsSchema = z.object({
  categories: z.array(z.string()),
  cities: geographySchema.shape.cities,
});
export type AlertOptions = z.infer<typeof alertOptionsSchema>;

export async function loadAlertOptions(
  assets: Fetcher,
  origin: string,
): Promise<AlertOptions> {
  const response = await assets.fetch(new URL(ALERT_OPTIONS_PATH, origin));
  if (!response.ok)
    throw new Error(`Alert options unavailable: ${response.status}`);
  return alertOptionsSchema.parse(await response.json());
}
