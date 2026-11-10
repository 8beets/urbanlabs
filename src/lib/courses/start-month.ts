import { addMonths, format, parseISO } from 'date-fns';
import { ISO_DATE, parseIsoDate } from '../time/dates';

export const START_MONTH_OPTIONS = 12;
const MONTH = 'yyyy-MM';

export function isStartMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/**
 * The current and following months as `YYYY-MM`. `today` is the catalogue's local date
 * (the live cutoff), so the options use the same clock as edition liveness and no
 * time zone is hard-coded here.
 */
export function startMonthOptions(today: string, past = false): string[] {
  const first = parseIsoDate(today);
  // The archive lists the current and previous months, newest first.
  return Array.from({ length: START_MONTH_OPTIONS }, (_, offset) =>
    format(addMonths(first, past ? -offset : offset), MONTH),
  );
}

/** Inclusive start and exclusive end dates (`YYYY-MM-DD`) of a `YYYY-MM` month. */
export function monthRange(month: string): [string, string] {
  const first = parseISO(`${month}-01`);
  return [format(first, ISO_DATE), format(addMonths(first, 1), ISO_DATE)];
}

export function startMonthLabel(month: string, locale: string): string {
  const label = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(parseISO(`${month}-01`));
  return label.charAt(0).toLocaleUpperCase(locale) + label.slice(1);
}
