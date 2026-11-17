import type { Locale } from '../i18n/ui';

/** The production origin (also `site` in astro.config.mjs). */
export const SITE = 'https://urbanlabs.fyi';

/** Open Graph locales for the interface languages. */
export const OG_LOCALES: Record<Locale, string> = {
  es: 'es_ES',
  ca: 'ca_ES',
};

export interface PageLinks {
  canonical: string;
  /** hreflang alternates: every language version, plus x-default (Spanish). */
  alternates: { hreflang: string; href: string }[];
}

/** An absolute URL on the site for a path, without its query string or fragment. */
export function absoluteUrl(path: string, site = SITE): string {
  const url = new URL(path, site);
  return `${url.origin}${url.pathname}`;
}

/**
 * Canonical and hreflang links for a page, from the localized paths every page already
 * passes to the layout (its own path in each language). Filters and pagination
 * parameters live in the query string, so they share the canonical of the unfiltered
 * page; numbered pages have their own path and keep it.
 */
export function pageLinks(
  locale: Locale,
  languagePaths: Record<Locale, string>,
  site = SITE,
): PageLinks {
  const entries = Object.entries(languagePaths) as [Locale, string][];
  return {
    canonical: absoluteUrl(languagePaths[locale], site),
    alternates: [
      ...entries.map(([language, path]) => ({
        hreflang: language,
        href: absoluteUrl(path, site),
      })),
      { hreflang: 'x-default', href: absoluteUrl(languagePaths.es, site) },
    ],
  };
}

/** JSON-LD for a <script> element: `<` is escaped so text can never close the tag. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replaceAll('<', '\\u003c');
}

/** schema.org WebSite for the home page. */
export function websiteData(locale: Locale, url: string, description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'UrbanLabs',
    url,
    inLanguage: locale,
    description,
  };
}

interface CentreFacts {
  name: string;
  address: string;
  city: string;
  country: string;
  official_url: string;
  phone: string | null;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
}

/**
 * schema.org Place for a centre page, from the facts the page shows. Unknown values are
 * left out rather than guessed; the address is kept as published (one line).
 */
export function centreData(centre: CentreFacts, pageUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: centre.name,
    url: pageUrl,
    sameAs: centre.official_url,
    address: {
      '@type': 'PostalAddress',
      streetAddress: centre.address,
      addressLocality: centre.city,
      addressCountry: centre.country,
    },
    ...(centre.latitude !== null && centre.longitude !== null
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: centre.latitude,
            longitude: centre.longitude,
          },
        }
      : {}),
    ...(centre.phone ? { telephone: centre.phone } : {}),
    ...(centre.email ? { email: centre.email } : {}),
  };
}
