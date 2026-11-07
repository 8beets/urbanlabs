import { m } from '../paraglide/messages.js';
import type { Locale } from './ui';
export function regionLabel(
  region: { id: string; name: string },
  locale: Locale,
): string {
  if (region.id === 'catalunya') return m.regionCatalunya({}, { locale });
  if (region.id === 'comunitat-valenciana')
    return m.regionValenciana({}, { locale });
  return region.name;
}

export function cityLabel(
  city: { id: string; name: string },
  locale: Locale,
): string {
  if (city.id === 'alicante') return m.cityAlicante({}, { locale });
  return city.name;
}
