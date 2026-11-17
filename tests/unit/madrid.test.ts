import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeSource, pathOf, readFixture } from '../helpers/source';
import {
  assertRecentSnapshot,
  createMadridAdapter,
  madridExternalId,
  madridRecord,
  madridRows,
  madridSchedule,
  newestCsvPath,
  parseCsv,
} from '../../src/lib/ingestion/adapters/madrid-datos-cursos';
import { courseRecordSchema } from '../../src/lib/ingestion/validation/record';
import { centres } from '../../src/lib/centres/registry';
import { toSourceConfig } from '../../src/lib/centres/schema';
import { sources } from '../../src/lib/sources';

const csv = readFixture('madrid-talleres.csv');
const pkg = readFixture('madrid-package.json');
const rows = madridRows(csv);
const source = (slug: string) =>
  toSourceConfig(centres.find((c) => c.id === `cc-mad-${slug}`)!);
const clara = source('centro-cultural-clara-del-rey-museo-abc');
// The fixture's FECHA_DATOS_FIN is 10/11/2026.
const SNAPSHOT_DAY = new Date('2026-11-10T12:00:00Z');
const PACKAGE_PATH =
  '/api/3/action/package_show?id=50064-0-talleres-culturales-cursos';
const CSV_PATH =
  '/dataset/50064-0-talleres-culturales-cursos/resource/50064-45-talleres-culturales-cursos/download/50064-0-talleres-culturales-cursos_134_20261111_195807.csv';

describe('Madrid cultural-centre courses dataset', () => {
  it('is ingested from datos.madrid.es', () => {
    const madrid = centres.filter((c) => c.cityId === 'madrid');
    expect(madrid).toHaveLength(83);
    expect(madrid.some((c) => c.pausedReason)).toBe(false);
    expect(
      sources.filter((s) => s.platform === 'madrid-datos-cursos'),
    ).toHaveLength(83);
  });

  it('picks the newest CSV snapshot', () => {
    expect(newestCsvPath(pkg)).toBe(CSV_PATH);
    const parsed = JSON.parse(pkg);
    parsed.result.resources.reverse();
    expect(newestCsvPath(JSON.stringify(parsed))).toBe(CSV_PATH);
  });

  it('rejects a snapshot older than a month', () => {
    const day = (iso: string) => new Date(`${iso}T12:00:00Z`);
    expect(() => assertRecentSnapshot(rows, day('2026-12-11'))).not.toThrow();
    expect(() => assertRecentSnapshot(rows, day('2026-12-12'))).toThrow(
      '32 days old (FECHA_DATOS_FIN 2026-11-10)',
    );
    expect(() =>
      assertRecentSnapshot([{ ...rows[0]!, FECHA_DATOS_FIN: '' }]),
    ).toThrow('no readable FECHA_DATOS_FIN');
    expect(() => assertRecentSnapshot([])).toThrow('no readable');
  });

  it('parses quoted semicolon CSV', () => {
    expect(parseCsv('\uFEFFa;"b ""c""";"d;e"\r\n1;;"x\ny"\r\n')).toEqual([
      ['a', 'b "c"', 'd;e'],
      ['1', '', 'x\ny'],
    ]);
    expect(() => parseCsv('"open')).toThrow('Quote Not Closed');
    expect(() => madridRows('A;B\r\n1;2\r\n')).toThrow('lacks column');
  });

  it('builds the weekly schedule from the per-day columns', () => {
    expect(rows[1]!.ORGANISMO_DESC).toBe('C.C. "CLARA DEL REY"');
    expect(madridSchedule(rows[1]!)).toBe('Lunes y miércoles, 19:00 (1 hora)');
    expect(madridSchedule(rows[0]!)).toBe('Jueves, 17:00 (3 horas)');
    expect(madridSchedule({ ...rows[0]!, HORA_INICIO_LUNES: '10:00' })).toBe(
      'Lunes 10:00; jueves 17:00 (3 horas)',
    );
    expect(madridSchedule({ ...rows[0]!, HORA_INICIO_JUEVES: '' })).toBeNull();
  });

  it('keeps groups with the same name for different audiences apart', () => {
    const [children, adults] = rows.filter(
      (r) => r.ORGANISMO_DESC === 'C.C. "PUERTA DE TOLEDO"',
    );
    expect(madridExternalId(children!)).not.toBe(madridExternalId(adults!));
    expect(madridExternalId(children!)).toMatch(/^teatro-[0-9a-f]{12}$/);
    expect(madridExternalId(children!)).toBe(
      madridExternalId({ ...children! }),
    );
  });

  it('maps a row without inventing dates or prices', () => {
    const record = madridRecord(rows[0]!, clara);
    expect(courseRecordSchema.safeParse(record).success).toBe(true);
    expect(record).toMatchObject({
      title: 'ACUARELA',
      officialUrl: clara.institution.url,
      startDate: null,
      endDate: null,
      priceCents: null,
      isSoldOut: true,
    });
    expect(madridRecord(rows[1]!, clara).isSoldOut).toBe(false);
  });
});

describe('Madrid adapter', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(SNAPSHOT_DAY);
  });
  afterEach(() => vi.useRealTimers());

  const run = () => {
    const { options, requests } = fakeSource((url) => {
      if (url.origin !== 'https://datos.madrid.es') return null;
      const path = pathOf(url.href);
      if (path === PACKAGE_PATH) return pkg;
      if (path === CSV_PATH) return csv;
      return null;
    });
    return { adapter: createMadridAdapter(options), requests };
  };

  it("keeps the centre's rows, trimming the dataset's padding", async () => {
    const { adapter, requests } = run();
    expect((await adapter.fetchRecords(clara)).map((r) => r.title)).toEqual([
      'ACUARELA',
      'BAILE EN LÍNEA',
      'BAILE EN LÍNEA',
      'CERÁMICA',
      'CERÁMICA',
      'CERÁMICA',
    ]);
    expect(
      await adapter.fetchRecords(
        source('centro-dotacional-integrado-arganzuela-angel-del-rio'),
      ),
    ).toHaveLength(2);
    // The portal authorised API and download access by email on 2026-11-17, so
    // robots.txt is not read: only the dataset record and its newest CSV.
    expect(new Set(requests.map(pathOf))).toEqual(
      new Set([PACKAGE_PATH, CSV_PATH]),
    );
  });

  it('fails instead of serving an old snapshot', async () => {
    vi.setSystemTime(new Date('2027-01-15T12:00:00Z'));
    const { adapter } = run();
    await expect(adapter.fetchRecords(clara)).rejects.toThrow('days old');
  });
});
