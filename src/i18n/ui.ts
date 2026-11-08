import { m } from '../paraglide/messages.js';
import type { Locale } from '../paraglide/runtime.js';
import { canonicalCategory } from '../lib/courses/categories';
import { parseIsoDate } from '../lib/time/dates';

export type { Locale } from '../paraglide/runtime.js';

// Explicit mappings keep unrecognized provider labels in their original language.
const categoryMessages = new Map([
  ['ACTIVITAT FÍSICA I BENESTAR', m.categoryPhysicalActivity],
  ['BALL', m.categoryDance],
  ['ESPECIAL GENT GRAN', m.categorySeniors],
  ['IDIOMES', m.categoryLanguages],
  ["ISA: FESTIVAL D'IL·LUSTRACIÓ", m.categoryIllustrationFestival],
  ['RECURSOS I CREATIVITAT', m.categoryResources],
  ['ALTRES', m.categoryOther],
  ['ART I CREATIVITAT', m.categoryArt],
  ['CUINA', m.categoryCooking],
  ['INFANTILS i JUVENILS', m.categoryYouth],
  ['MÚSICA', m.categoryMusic],
  ['NOVES TECNOLOGIES', m.categoryTechnology],
  ['FOTOGRAFIA', m.categoryPhotography],
  ['CINEMA', m.categoryCinema],
  ['CIÈNCIES I HUMANITATS', m.categoryScienceHumanities],
  ['EXPRESSIÓ', m.categoryExpression],
  ['HUMANITATS', m.categoryHumanities],
  ['Actualitat i història', m.categoryHistory],
  ['Antropologia', m.categoryAnthropology],
  ['Art i pensament', m.categoryArtThought],
  ['Natura i ciència', m.categoryNatureScience],
  ['Creixement personal', m.categoryPersonalGrowth],
  ['HABILITATS I COMPETÈNCIES', m.categorySkills],
  ['Art tèxtil', m.categoryTextileArt],
  ['Ciència', m.categoryScience],
  ['Ràdio i pòdcast', m.categoryRadioPodcast],
  ['FAMILIARS', m.categoryFamily],
  ['INFORMÀTICA PER A GENT GRAN', m.categorySeniorComputing],
  ['FABRICACIÓ DIGITAL I ROBÒTICA', m.categoryDigitalFabrication],
  ['MÉS ECO', m.categoryEco],
  ['PARAULA', m.categoryWord],
  ["ReGENERA'T", m.categoryRegenerat],
]);

export function categoryLabel(category: string, locale: Locale): string {
  const canonical = canonicalCategory(category);
  const message = categoryMessages.get(canonical);
  if (message) return message({}, { locale });
  if (canonical !== canonical.toLocaleUpperCase(locale)) return canonical;
  const lower = canonical.toLocaleLowerCase(locale);
  return lower.charAt(0).toLocaleUpperCase(locale) + lower.slice(1);
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
