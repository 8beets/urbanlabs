import { getRelativeLocaleUrl } from 'astro:i18n';
import type { Locale } from './ui';

export function courseSearchPath(locale: Locale): string {
  return getRelativeLocaleUrl(
    locale,
    locale === 'es' ? 'buscar' : 'cerca',
  ).replace(/\/$/, '');
}

export function homePath(locale: Locale): string {
  return `${getRelativeLocaleUrl(locale).replace(/\/$/, '')}/`;
}

export function centreDirectoryPath(locale: Locale): string {
  return getRelativeLocaleUrl(
    locale,
    locale === 'es' ? 'centros' : 'centres',
  ).replace(/\/$/, '');
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
