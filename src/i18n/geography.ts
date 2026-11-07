import type { Locale } from './ui';
export function regionLabel(
  region: { id: string; name: string },
  locale: Locale,
): string {
  if (region.id === 'catalunya')
    return locale === 'es' ? 'Cataluña' : 'Catalunya';
  return region.name;
}
