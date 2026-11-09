import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { hasSoldOutNotice } from '../../src/lib/ingestion/normalization/availability';
import { parseMiramPage } from '../../src/lib/ingestion/adapters/miram';

const url =
  'https://example.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=1&t=AC';
const parse = (name: string) =>
  parseMiramPage(
    readFileSync(new URL(`../fixtures/${name}.html`, import.meta.url), 'utf8'),
    url,
  ).records;

describe('sold-out evidence', () => {
  it('reads the explicit Miram notice from real saved cards', () => {
    expect(parse('miram-can-baste-languages').map((r) => r.isSoldOut)).toEqual([
      true,
      true,
    ]);
    expect(parse('miram-fab-casa-del-mig')[0]!.isSoldOut).toBe(true);
    expect(
      parse('miram-sant-andreu-languages').map((r) => r.isSoldOut),
    ).toEqual([false, false, false, false]);
  });
  it('matches only the notice itself, never other footer text', () => {
    expect(
      hasSoldOutNotice([
        "Places exhaurides. Si vols apuntar-te a la llista d'espera",
      ]),
    ).toBe(true);
    for (const text of [
      '',
      "Apunta't a la llista d'espera",
      'Hi ha places exhaurides al grup B',
      'Podreu realitzar les inscripcions en línia a partir del 01/01/2027',
    ])
      expect(hasSoldOutNotice([text])).toBe(false);
  });
});
