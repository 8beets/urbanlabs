import { getRelativeLocaleUrl } from 'astro:i18n';
import { m } from '../paraglide/messages.js';
import type { Locale } from './ui';

export function courseSearchPath(locale: Locale): string {
  return getRelativeLocaleUrl(locale, m.pathSearch({}, { locale })).replace(
    /\/$/,
    '',
  );
}

export function homePath(locale: Locale): string {
  return `${getRelativeLocaleUrl(locale).replace(/\/$/, '')}/`;
}

export function centreDirectoryPath(locale: Locale): string {
  return getRelativeLocaleUrl(locale, m.pathCentres({}, { locale })).replace(
    /\/$/,
    '',
  );
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
    'cancellation',
  ].some((key) => params.has(key));
}
