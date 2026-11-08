const TIME_ZONE = 'Europe/Madrid';
export const START_MONTH_OPTIONS = 12;

export function isStartMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** Current and following months as `YYYY-MM`, counted in the centres' local time zone. */
export function startMonthOptions(now = new Date()): string[] {
  const [year, month] = now
    .toLocaleDateString('sv-SE', { timeZone: TIME_ZONE })
    .split('-')
    .map(Number) as [number, number];
  return Array.from({ length: START_MONTH_OPTIONS }, (_, offset) => {
    const index = month - 1 + offset;
    const y = year + Math.floor(index / 12);
    return `${y}-${String((index % 12) + 1).padStart(2, '0')}`;
  });
}

/** Inclusive start and exclusive end dates (`YYYY-MM-DD`) of a `YYYY-MM` month. */
export function monthRange(month: string): [string, string] {
  const [year, number] = month.split('-').map(Number) as [number, number];
  const next =
    number === 12
      ? `${year + 1}-01`
      : `${year}-${String(number + 1).padStart(2, '0')}`;
  return [`${month}-01`, `${next}-01`];
}

export function startMonthLabel(month: string, locale: string): string {
  const [year, number] = month.split('-').map(Number) as [number, number];
  const label = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, number - 1, 1)));
  return label.charAt(0).toLocaleUpperCase(locale) + label.slice(1);
}
