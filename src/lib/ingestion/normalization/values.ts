import { format, isExists, isValid, parse, type Month } from 'date-fns';
import { ca } from 'date-fns/locale';
import { ISO_DATE } from '../../time/dates';

// Source pages use Catalan month names; the locale data is the single source of truth.
// Matching stays exact (full names only): similar-looking words never become dates.
const catalanMonths = new Map(
  Array.from({ length: 12 }, (_, index) => [
    ca.localize.month(index as Month, { width: 'wide' }).toLowerCase(),
    index + 1,
  ]),
);

/** Month number (1–12) for a full Catalan month name, or undefined. */
export function catalanMonthNumber(name: string): number | undefined {
  return catalanMonths.get(name.toLowerCase());
}

export function cleanText(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

export function localDate(
  day: string,
  month: number | undefined,
  year: string,
): string | null {
  if (month === undefined || !isExists(Number(year), month - 1, Number(day)))
    return null;
  return format(new Date(Number(year), month - 1, Number(day)), ISO_DATE);
}

/** "dd/mm/yyyy" as an ISO date, or null when it is not a real date (e.g. 31/02/2026). */
export function dmyDate(value: string): string | null {
  // A four-digit year only: date-fns would read "06/10/26" as the year 26.
  if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/u.test(value.trim())) return null;
  const date = parse(value.trim(), 'd/M/yyyy', new Date(0));
  return isValid(date) ? format(date, ISO_DATE) : null;
}

/** An amount such as "12,50", "33.19" or "37" in cents, with exact decimal arithmetic. */
export function euroCents(amount: string): number | null {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/u.exec(amount.trim());
  if (!match) return null;
  const cents =
    Number(match[1]) * 100 + Number((match[2] ?? '0').padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function parseDateRange(value: string): [string | null, string | null] {
  const dates = [
    ...value
      .toLowerCase()
      .matchAll(/(\d{1,2})\s+d[e’']\s*([\p{L}]+)\s+de\s+(\d{4})/gu),
  ].map((match) =>
    localDate(match[1]!, catalanMonths.get(match[2]!), match[3]!),
  );
  if (
    /^\d{1,2}\s+d[e’']\s*[\p{L}]+\s+de\s+\d{4}$/u.test(value.trim()) &&
    dates.length === 1 &&
    dates[0]
  )
    return [dates[0], dates[0]];
  if (dates.length !== 2 || !dates[0] || !dates[1] || dates[0] > dates[1])
    return [null, null];
  return [dates[0], dates[1]];
}

// Only the explicitly labelled base price, never a discounted or materials price.
export function parseEuroPrice(value: string): number | null {
  if (/^Preu:\s*Gratuït\s*$/iu.test(cleanText(value))) return 0;
  const match = /^Preu:\s*(\d+(?:\.\d{3})*),(\d{2})\s*€/u.exec(
    cleanText(value),
  );
  if (!match) return null;
  const cents = Number(match[1]!.replaceAll('.', '')) * 100 + Number(match[2]);
  return Number.isSafeInteger(cents) ? cents : null;
}

export async function hash(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return new Uint8Array(bytes).toHex();
}
