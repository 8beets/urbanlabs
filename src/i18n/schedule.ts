import { m } from '../paraglide/messages.js';
import { locales } from '../paraglide/runtime.js';
import type { Locale } from './ui';

// Source schedules name weekdays in Spanish (Zaragoza, Vitoria) or Catalan (Barcelona,
// Girona, El Prat…); each is shown in the interface language. Plurals ("sábados",
// "dissabtes") add an "s" in both languages.
// 2024-01-01 is a Monday; the weekdayName message formats it in each locale.
const names = Object.fromEntries(
  locales.map((locale) => [
    locale,
    Array.from({ length: 7 }, (_, day) =>
      m
        .weekdayName({ date: Date.UTC(2024, 0, 1 + day) }, { locale })
        .toLocaleLowerCase(locale),
    ),
  ]),
) as Record<Locale, string[]>;
const sourceWeekday = (locale: Locale) =>
  new RegExp(`(?<!\\p{L})(${names[locale].join('|')})(s?)(?!\\p{L})`, 'giu');
const other = (locale: Locale): Locale => (locale === 'es' ? 'ca' : 'es');

/** Keeps the source word's capitalisation (all caps or initial capital). */
function matchCase(word: string, translated: string, locale: Locale) {
  if (word === word.toUpperCase()) return translated.toLocaleUpperCase(locale);
  if (word[0] === word[0]!.toUpperCase())
    return translated[0]!.toUpperCase() + translated.slice(1);
  return translated;
}

/** Format known calendar terms without translating source prose or inferring sessions. */
export function formatSchedule(value: string, locale: Locale): string {
  const source = other(locale);
  const translated = value.replace(
    sourceWeekday(source),
    (word, day: string, plural: string) =>
      matchCase(
        word,
        names[locale][names[source].indexOf(day.toLocaleLowerCase(source))]! +
          plural.toLocaleLowerCase(locale),
        locale,
      ),
  );
  if (locale === 'ca') return translated;
  // "Dilluns i dimarts" → "Lunes y martes": the Catalan "i" between weekdays.
  return translated.replace(
    new RegExp(
      `(?<!\\p{L})i(?=\\s+(?:${names.es.join('|')})s?(?!\\p{L}))`,
      'giu',
    ),
    (word) => {
      const conjunction = m.weekdayAnd({}, { locale });
      return word === 'I' ? conjunction.toLocaleUpperCase(locale) : conjunction;
    },
  );
}
