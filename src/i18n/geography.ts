import { geographyCity } from '../lib/locations/registry';
import { sourceCities } from '../lib/sources';
import type { Locale } from './ui';

/** A city's name in the locale (data/geography.json), or its stored name. */
export function cityLabel(
  city: { id: string; name: string },
  locale: Locale,
): string {
  return geographyCity(city.id)?.names[locale] ?? city.name;
}

/** Cities with an approved source, labelled and sorted for the locale. */
export function sourceCityLabels(locale: Locale) {
  return sourceCities()
    .map((city) => ({ ...city, label: cityLabel(city, locale) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}

/** "Barcelona y Zaragoza": the cities UrbanLabs covers, for site copy. */
export function coveredCities(locale: Locale): string {
  return new Intl.ListFormat(locale, { type: 'conjunction' }).format(
    sourceCityLabels(locale).map((city) => city.label),
  );
}
