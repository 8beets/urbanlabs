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

/** Format known calendar terms without translating source prose or inferring sessions. */
export function formatSchedule(value: string, locale: Locale): string {
  if (locale !== 'es') return value;
  return value
    .replace(
      /\b(dilluns|dimarts|dimecres|dijous|divendres|dissabtes?|diumenges?)\b/gi,
      (word) => {
        const translated = weekdayMessages[word.toLowerCase()]!({}, { locale });
        if (word === word.toUpperCase())
          return translated.toLocaleUpperCase('es');
        if (word[0] === word[0]!.toUpperCase())
          return translated[0]!.toUpperCase() + translated.slice(1);
        return translated;
      },
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
