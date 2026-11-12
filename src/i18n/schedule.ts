import { m } from '../paraglide/messages.js';
import type { Locale } from './ui';

const weekdayMessages: Record<string, typeof m.weekday_dilluns> = {
  dilluns: m.weekday_dilluns,
  dimarts: m.weekday_dimarts,
  dimecres: m.weekday_dimecres,
  dijous: m.weekday_dijous,
  divendres: m.weekday_divendres,
  dissabte: m.weekday_dissabte,
  dissabtes: m.weekday_dissabtes,
  diumenge: m.weekday_diumenge,
  diumenges: m.weekday_diumenges,
};

// Spanish source weekdays (e.g. Zaragoza) and the Catalan word for each.
const spanishWeekdays: Record<string, keyof typeof weekdayMessages> = {
  lunes: 'dilluns',
  martes: 'dimarts',
  miércoles: 'dimecres',
  jueves: 'dijous',
  viernes: 'divendres',
  sábado: 'dissabte',
  sábados: 'dissabtes',
  domingo: 'diumenge',
  domingos: 'diumenges',
};

/** Keeps the source word's capitalisation (all caps or initial capital). */
function matchCase(word: string, translated: string, locale: Locale) {
  if (word === word.toUpperCase()) return translated.toLocaleUpperCase(locale);
  if (word[0] === word[0]!.toUpperCase())
    return translated[0]!.toUpperCase() + translated.slice(1);
  return translated;
}

/** Format known calendar terms without translating source prose or inferring sessions. */
export function formatSchedule(value: string, locale: Locale): string {
  if (locale === 'ca')
    return value.replace(
      /(?<!\p{L})(lunes|martes|miércoles|jueves|viernes|sábados?|domingos?)(?!\p{L})/giu,
      (word) =>
        matchCase(
          word,
          weekdayMessages[spanishWeekdays[word.toLowerCase()]!]!(
            {},
            { locale },
          ),
          locale,
        ),
    );
  return value
    .replace(
      /\b(dilluns|dimarts|dimecres|dijous|divendres|dissabtes?|diumenges?)\b/gi,
      (word) =>
        matchCase(
          word,
          weekdayMessages[word.toLowerCase()]!({}, { locale }),
          locale,
        ),
    )
    .replace(
      /\bi\b(?=\s+(?:lunes|martes|miércoles|jueves|viernes|sábados?|domingos?)\b)/gi,
      (word) => {
        const conjunction = m.weekdayAnd({}, { locale });
        return word === 'I'
          ? conjunction.toLocaleUpperCase(locale)
          : conjunction;
      },
    );
}
