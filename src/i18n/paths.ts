import { m } from '../paraglide/messages.js';
import type { Locale } from './ui';

// Every locale is prefixed (`prefixDefaultLocale: true` in astro.config.mjs). These
// helpers build the same URLs as `astro:i18n` without depending on that virtual
// module, so browser scripts such as the static search can use them too.
// Courses and centres live under their city (docs/adr/0010-city-sections.md); the city
// segment is the city id in every locale.

/** Path segments that a city id must never take. */
export const RESERVED_SEGMENTS = [
  'cursos',
  'centros',
  'centres',
  'alertas',
  'alertes',
  '404',
] as const;

export function homePath(locale: Locale): string {
  return `/${locale}/`;
}

/** The city page, an index route like the homepage (hence the trailing slash). */
export function cityPath(locale: Locale, city: string): string {
  return `/${locale}/${city}/`;
}

/** The list of cities to search courses in. */
export function citiesCoursesPath(locale: Locale): string {
  return `/${locale}/${m.pathCourses({}, { locale })}`;
}

/** The list of cities to browse centres in. */
export function citiesCentresPath(locale: Locale): string {
  return `/${locale}/${m.pathCentres({}, { locale })}`;
}

export function courseSearchPath(locale: Locale, city: string): string {
  return `${cityPath(locale, city)}${m.pathCourses({}, { locale })}`;
}

export function topicPath(locale: Locale, city: string, topic: string): string {
  return `${courseSearchPath(locale, city)}/${topic}`;
}

export function centreDirectoryPath(locale: Locale, city: string): string {
  return `${cityPath(locale, city)}${m.pathCentres({}, { locale })}`;
}

export function centrePath(locale: Locale, city: string, slug: string): string {
  return `${centreDirectoryPath(locale, city)}/${slug}`;
}
