import { describe, expect, it } from 'vitest';
import { parseFilters } from '../../src/lib/courses/discovery';
import {
  isStartMonth,
  monthRange,
  startMonthLabel,
  startMonthOptions,
} from '../../src/lib/courses/start-month';
import { earliestLocalDate } from '../../src/lib/time/dates';

describe('start month filter', () => {
  it('lists the current and next 11 months, crossing the year boundary', () => {
    expect(startMonthOptions('2026-11-08')).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
      '2027-03',
      '2027-04',
      '2027-05',
      '2027-06',
      '2027-07',
      '2027-08',
      '2027-09',
      '2027-10',
    ]);
  });
  it('counts from the given catalogue date, including month ends', () => {
    expect(startMonthOptions('2026-01-31')[1]).toBe('2026-02');
    expect(startMonthOptions('2026-12-31')[0]).toBe('2026-12');
    expect(startMonthOptions('2026-12-31')[1]).toBe('2027-01');
  });
  it('derives the current month from the live cutoff, not a fixed zone', () => {
    // 23:30 UTC on 31 October is already 1 November in Madrid but not in Lisbon.
    const now = new Date('2026-10-31T23:30:00Z');
    expect(
      startMonthOptions(earliestLocalDate(['Europe/Madrid'], now))[0],
    ).toBe('2026-11');
    expect(
      startMonthOptions(
        earliestLocalDate(['Europe/Madrid', 'Atlantic/Azores'], now),
      )[0],
    ).toBe('2026-10');
  });
  it('returns half-open date ranges, including December', () => {
    expect(monthRange('2026-11')).toEqual(['2026-11-01', '2026-12-01']);
    expect(monthRange('2026-12')).toEqual(['2026-12-01', '2027-01-01']);
  });
  it('formats localized labels', () => {
    expect(startMonthLabel('2026-11', 'es')).toBe('Noviembre de 2026');
    expect(startMonthLabel('2027-01', 'ca')).toMatch(/^Gener/);
  });
  it('validates the URL parameter', () => {
    for (const valid of ['2026-01', '2026-12'])
      expect(isStartMonth(valid)).toBe(true);
    for (const invalid of [
      '2026-00',
      '2026-13',
      '2026-1',
      '26-01',
      '2026-01-01',
      '',
    ])
      expect(isStartMonth(invalid)).toBe(false);
    expect(parseFilters(new URLSearchParams('start=2027-03')).startMonth).toBe(
      '2027-03',
    );
    expect(parseFilters(new URLSearchParams('')).startMonth).toBe('');
    expect(() => parseFilters(new URLSearchParams('start=2027-13'))).toThrow(
      'Invalid start month',
    );
  });
});
