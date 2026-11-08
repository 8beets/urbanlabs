import { format, isValid, parseISO } from 'date-fns';
import { TZDate } from '@date-fns/tz';

/** Calendar dates are stored and compared as ISO `yyyy-MM-dd` strings. */
export const ISO_DATE = 'yyyy-MM-dd';

const ISO_DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/** True for real calendar dates only (no 2026-02-30 and no month 13). */
export function isIsoDate(value: string): boolean {
  return ISO_DATE_SHAPE.test(value) && isValid(parseISO(value));
}

/** Parses an ISO calendar date as a local-midnight `Date` for display formatting. */
export function parseIsoDate(value: string): Date {
  if (!isIsoDate(value)) throw new Error(`Invalid calendar date: ${value}`);
  return parseISO(value);
}

/** True when the string is an IANA time zone the runtime understands. */
export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** The calendar date it currently is in an IANA time zone (DST-aware). */
export function localDateIn(timeZone: string, now: Date = new Date()): string {
  return format(new TZDate(now, timeZone), ISO_DATE);
}

/**
 * The earliest current calendar date across the given time zones. Comparing an
 * edition's end date with this never hides an edition before it has ended in its
 * own zone; one in a zone further ahead can stay listed for up to a day longer.
 * Falls back to UTC when no zone is known.
 */
export function earliestLocalDate(
  timeZones: Iterable<string>,
  now: Date = new Date(),
): string {
  const dates = [...new Set(timeZones)].map((zone) => localDateIn(zone, now));
  return dates.length
    ? dates.reduce((a, b) => (a < b ? a : b))
    : localDateIn('UTC', now);
}
