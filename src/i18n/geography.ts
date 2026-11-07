import type { Locale } from './ui';
export function regionLabel(
  region: { id: string; name: string },
  locale: Locale,
): string {
  if (region.id === 'catalunya')
    return locale === 'es' ? 'Cataluña' : 'Catalunya';
  if (region.id === 'comunitat-valenciana')
    return locale === 'es' ? 'Comunidad Valenciana' : 'Comunitat Valenciana';
  return region.name;
}

export function cityLabel(
  city: { id: string; name: string },
  locale: Locale,
): string {
  if (city.id === 'alicante') return locale === 'es' ? 'Alicante' : 'Alacant';
  return city.name;
}
