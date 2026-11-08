import { getSource } from '../../src/lib/sources';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hasCancellationNotice } from '../../src/lib/ingestion/normalization/cancellation';
import { parseMiramPage } from '../../src/lib/ingestion/adapters/miram';
import { parseFilters } from '../../src/lib/courses/discovery';
import { courseRecordSchema } from '../../src/lib/ingestion/validation/record';

const patiLlimona = getSource('miram-pati-llimona');

describe('explicit cancellation evidence', () => {
  it('extracts the real cancelled titles, keeping identities, zero prices and unknown availability', () => {
    const html = readFileSync(
      new URL('../fixtures/miram-pati-llimona-cancelled.html', import.meta.url),
      'utf8',
    );
    const records = parseMiramPage(
      html,
      `${patiLlimona.listingUrl}&f=11`,
    ).records;
    expect(
      records.map(({ externalId, isCancelled, priceCents, availability }) => ({
        externalId,
        isCancelled,
        priceCents,
        availability,
      })),
    ).toEqual([
      {
        externalId: '5036',
        isCancelled: true,
        priceCents: 0,
        availability: null,
      },
      {
        externalId: '5038',
        isCancelled: true,
        priceCents: 0,
        availability: null,
      },
    ]);
    expect(patiLlimona.excludedExternalIds).toEqual(['5088']);
    expect(() =>
      courseRecordSchema.parse({ ...records[0], isCancelled: 'yes' }),
    ).toThrow();
  });
  it('detects the real FAB cancellation notice inside the course description', () => {
    const html = readFileSync(
      new URL('../fixtures/miram-fab-casa-del-mig.html', import.meta.url),
      'utf8',
    );
    expect(
      parseMiramPage(html, 'https://fabcasadelmig.miram.cloud/').records[0],
    ).toMatchObject({
      externalId: '674',
      isCancelled: true,
      priceCents: 4120,
      availability: null,
    });
  });
  it.each([
    'ANUL·LAT',
    'ANUL.LADA',
    'CANCEL·LADA',
    'CANCEL.LAT',
    'CANCELADO',
    'ANULADA',
  ])('recognizes the explicit title marker %s', (marker) => {
    expect(hasCancellationNotice(`Taller de fotografia (${marker})`, [])).toBe(
      true,
    );
  });
  it('does not confuse missing notices, waitlists, policies or centre closures with cancellation', () => {
    for (const notice of [
      '',
      'Places exhaurides',
      'Si el taller es cancel·la, retornarem els diners.',
      'No es permet anul·lar la inscripció.',
      'El centre està tancat temporalment.',
      'Si el curs és cancel·lat avisarem per correu.',
    ])
      expect(hasCancellationNotice('Taller de fotografia', [notice])).toBe(
        false,
      );
  });
  it('validates shareable cancellation filters', () => {
    for (const value of ['', 'hide', 'only'])
      expect(
        parseFilters(new URLSearchParams({ cancellation: value })).cancellation,
      ).toBe(value);
    for (const value of ['true', 'all', "' OR 1=1"])
      expect(() =>
        parseFilters(new URLSearchParams({ cancellation: value })),
      ).toThrow();
  });
});
