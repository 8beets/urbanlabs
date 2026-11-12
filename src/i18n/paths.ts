import { m } from '../paraglide/messages.js';
import type { Locale } from './ui';

// Every locale is prefixed (`prefixDefaultLocale: true` in astro.config.mjs). These
// helpers build the same URLs as `astro:i18n` without depending on that virtual
// module, so browser scripts such as the static search can use them too.

export function courseSearchPath(locale: Locale): string {
  return `/${locale}/${m.pathSearch({}, { locale })}`;
}

export function homePath(locale: Locale): string {
  return `/${locale}/`;
}

export function centreDirectoryPath(locale: Locale): string {
  return `/${locale}/${m.pathCentres({}, { locale })}`;
}
