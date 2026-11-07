import type { Locale } from './ui';

export function courseSearchPath(locale: Locale): string {
  return locale === 'es' ? '/es/buscar' : '/ca/cerca';
}

// Keep existing bookmarked filter URLs working after discovery moves off the homepage.
export function hasDiscoveryParams(params: URLSearchParams): boolean {
  return [
    'q',
    'centre',
    'category',
    'maxPrice',
    'page',
    'country',
    'region',
    'city',
  ].some((key) => params.has(key));
}
