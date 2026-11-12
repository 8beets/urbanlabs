import { m } from '../paraglide/messages.js';
import type { Locale } from '../paraglide/runtime.js';
import { isTopic, type Audience, type Topic } from '../lib/courses/categories';
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

export function categoryLabel(category: string, locale: Locale): string {
  return isTopic(category) ? topicMessages[category]({}, { locale }) : category;
}

const audienceMessages: Record<Audience, typeof m.audienceFamilies> = {
  families: m.audienceFamilies,
  'infants-i-joves': m.audienceYouth,
  'gent-gran': m.audienceSeniors,
  dones: m.audienceWomen,
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
