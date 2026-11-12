import { m } from '../paraglide/messages.js';
import type { Locale } from '../paraglide/runtime.js';
import {
  canonicalCategory,
  isTopic,
  type Audience,
  type Topic,
} from '../lib/courses/categories';
import { parseIsoDate } from '../lib/time/dates';

export type { Locale } from '../paraglide/runtime.js';

const topicMessages: Record<Topic, typeof m.topicOther> = {
  'arts-i-manualitats': m.topicArts,
  'fotografia-i-audiovisual': m.topicPhotography,
  musica: m.topicMusic,
  dansa: m.topicDance,
  teatre: m.topicTheatre,
  'activitat-fisica': m.topicFitness,
  benestar: m.topicWellbeing,
  cuina: m.topicCooking,
  idiomes: m.topicLanguages,
  'humanitats-i-ciencia': m.topicHumanities,
  tecnologia: m.topicTechnology,
  natura: m.topicNature,
  altres: m.topicOther,
};

/** A topic's label; a legacy source category from an old link keeps its own words. */
export function categoryLabel(category: string, locale: Locale): string {
  const canonical = canonicalCategory(category);
  if (isTopic(canonical)) return topicMessages[canonical]({}, { locale });
  if (canonical !== canonical.toLocaleUpperCase(locale)) return canonical;
  const lower = canonical.toLocaleLowerCase(locale);
  return lower.charAt(0).toLocaleUpperCase(locale) + lower.slice(1);
}

const audienceMessages: Record<Audience, typeof m.audienceFamilies> = {
  families: m.audienceFamilies,
  'infants-i-joves': m.audienceYouth,
  'gent-gran': m.audienceSeniors,
};

export function audienceLabel(audience: Audience, locale: Locale): string {
  return audienceMessages[audience]({}, { locale });
}

const errorMessages = {
  invalid: m.invalid,
  unavailable: m.unavailable,
  notFound: m.notFound,
};

export function pageErrorMessage(
  error: keyof typeof errorMessages,
  locale: Locale,
): string {
  return errorMessages[error]({}, { locale });
}

export function formatLocalDate(value: string, locale: Locale): string {
  // Intl keeps Catalan elision ("d’abr.") and "de" that date-fns locale patterns lack.
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    parseIsoDate(value),
  );
}
