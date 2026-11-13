import { describe, expect, it } from 'vitest';
import {
  earliestLocalDate,
  isIsoDate,
  isTimeZone,
  localDateIn,
  parseIsoDate,
  weekdayNames,
} from '../../src/lib/time/dates';
import {
  dmyDate,
  euroCents,
  localDate,
  parseDateRange,
} from '../../src/lib/ingestion/normalization/values';
import { formatLocalDate } from '../../src/i18n/ui';

describe('calendar dates', () => {
  it.each(['2026-11-08', '2024-02-29', '2026-12-31'])('accepts %s', (value) => {
    expect(isIsoDate(value)).toBe(true);
  });

  it.each([
    '2026-02-30',
    '2025-02-29',
    '2026-13-01',
    '2026-00-10',
    '2026-1-1',
    '26-11-08',
    '2026-11-08T00:00:00Z',
    '',
  ])('rejects %j', (value) => {
    expect(isIsoDate(value)).toBe(false);
    expect(() => parseIsoDate(value)).toThrow();
  });

  it('builds source dates only for real calendar days', () => {
    expect(localDate('8', 11, '2026')).toBe('2026-11-08');
    expect(localDate('29', 2, '2024')).toBe('2024-02-29');
    expect(localDate('29', 2, '2026')).toBeNull();
    expect(localDate('31', 4, '2026')).toBeNull();
    expect(localDate('1', undefined, '2026')).toBeNull();
  });

  it('reads exact Catalan month names and nothing similar', () => {
    expect(
      parseDateRange('Del 15 de setembre de 2026 al 10 de novembre de 2026'),
    ).toEqual(['2026-09-15', '2026-11-10']);
    expect(parseDateRange('3 d’abril de 2027')).toEqual([
      '2027-04-03',
      '2027-04-03',
    ]);
    // Abbreviations and other languages are not guessed.
    expect(
      parseDateRange('Del 15 de set de 2026 al 10 de nov de 2026'),
    ).toEqual([null, null]);
    expect(
      parseDateRange('Del 1 de marzo de 2026 al 2 de abril de 2026'),
    ).toEqual([null, null]);
  });

  it('formats a stored date the same in every runtime zone', () => {
    expect(formatLocalDate('2026-11-08', 'es')).toBe('8 nov 2026');
    expect(formatLocalDate('2026-03-01', 'ca')).toBe('1 de març 2026');
  });
});

describe('time zones', () => {
  const instant = new Date('2026-11-08T23:30:00Z');

  it('derives the current date in any IANA zone', () => {
    expect(localDateIn('UTC', instant)).toBe('2026-11-08');
    expect(localDateIn('Europe/Madrid', instant)).toBe('2026-11-09');
    expect(localDateIn('Atlantic/Canary', instant)).toBe('2026-11-08');
    expect(localDateIn('America/Bogota', instant)).toBe('2026-11-08');
    expect(localDateIn('Asia/Tokyo', instant)).toBe('2026-11-09');
  });

  it('follows daylight saving changes', () => {
    // Madrid moves from UTC+1 to UTC+2 on 2026-03-29 at 01:00 UTC.
    expect(localDateIn('Europe/Madrid', new Date('2026-03-28T22:59:00Z'))).toBe(
      '2026-03-28',
    );
    expect(localDateIn('Europe/Madrid', new Date('2026-03-28T23:00:00Z'))).toBe(
      '2026-03-29',
    );
    expect(localDateIn('Europe/Madrid', new Date('2026-10-24T22:30:00Z'))).toBe(
      '2026-10-25',
    );
    expect(localDateIn('Europe/Madrid', new Date('2026-10-25T22:30:00Z'))).toBe(
      '2026-10-25',
    );
  });

  it('never hides an edition before it ends in the earliest zone in use', () => {
    expect(
      earliestLocalDate(['Europe/Madrid', 'Atlantic/Canary'], instant),
    ).toBe('2026-11-08');
    expect(
      earliestLocalDate(['Asia/Tokyo', 'Europe/Madrid', 'Asia/Tokyo'], instant),
    ).toBe('2026-11-09');
    expect(earliestLocalDate([], instant)).toBe('2026-11-08');
  });

  it('recognises IANA zones only', () => {
    expect(isTimeZone('Europe/Madrid')).toBe(true);
    expect(isTimeZone('UTC')).toBe(true);
    expect(isTimeZone('Madrid')).toBe(false);
    expect(isTimeZone('TODO: IANA time zone')).toBe(false);
  });
});

describe('shared source values', () => {
  it('reads dd/mm/yyyy dates only when they exist', () => {
    expect(dmyDate('06/10/2026')).toBe('2026-10-06');
    expect(dmyDate(' 1/2/2027 ')).toBe('2027-02-01');
    for (const value of ['31/02/2026', '2026-10-06', '06/10/26', ''])
      expect(dmyDate(value)).toBeNull();
  });

  it('turns euro amounts into exact cents', () => {
    expect(euroCents('37')).toBe(3700);
    expect(euroCents('12,5')).toBe(1250);
    expect(euroCents('33.19')).toBe(3319);
    // 0.29 * 100 is 28.999… in floating point; the cents must still be exact.
    expect(euroCents('0,29')).toBe(29);
    for (const value of ['', '12,345', '1.234,56', '€5', '-3'])
      expect(euroCents(value)).toBeNull();
  });
});

describe('weekday names', () => {
  it('come from the runtime locale data, Monday first', () => {
    expect(weekdayNames('es')).toEqual([
      'lunes',
      'martes',
      'miércoles',
      'jueves',
      'viernes',
      'sábado',
      'domingo',
    ]);
    expect(weekdayNames('ca')[0]).toBe('dilluns');
    expect(weekdayNames('ca')[6]).toBe('diumenge');
  });
});
