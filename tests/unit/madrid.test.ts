import { describe, expect, it } from 'vitest';
import { fakeSource, pathOf, readFixture } from '../helpers/source';
import {
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
const CSV_PATH =
  '/dataset/50064-0-talleres-culturales-cursos/resource/50064-45-talleres-culturales-cursos/download/50064-0-talleres-culturales-cursos_134_20261111_195807.csv';

describe('Madrid cultural-centre courses dataset', () => {
  it('is paused until automated access is allowed', () => {
    const madrid = centres.filter((c) => c.cityId === 'madrid');
    expect(madrid).toHaveLength(83);
    expect(madrid.every((c) => c.pausedReason)).toBe(true);
    expect(sources.some((s) => s.platform === 'madrid-datos-cursos')).toBe(
      false,
    );
  });

  it('picks the newest CSV snapshot', () => {
    expect(newestCsvPath(pkg)).toBe(CSV_PATH);
    const parsed = JSON.parse(pkg);
    parsed.result.resources.reverse();
    expect(newestCsvPath(JSON.stringify(parsed))).toBe(CSV_PATH);
  });

  it('parses quoted semicolon CSV', () => {
    expect(parseCsv('\uFEFFa;"b ""c""";"d;e"\r\n1;;"x\ny"\r\n')).toEqual([
      ['a', 'b "c"', 'd;e'],
      ['1', '', 'x\ny'],
    ]);
    expect(() => parseCsv('"open')).toThrow('Unterminated');
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
  const run = (robots: string | null = null) => {
    const { options, requests } = fakeSource((url) => {
      const path = pathOf(url.href);
      if (path === '/robots.txt') return robots;
      if (path.startsWith('/api/3/action/package_show')) return pkg;
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
    expect(requests.map(pathOf)).toContain(CSV_PATH);
  });

  it('stops when robots.txt disallows the API, as it does since 2026-11-13', async () => {
    const { adapter, requests } = run(
      'User-agent: *\nDisallow: /api/\nDisallow: /dataset/*/resource/*\n',
    );
    await expect(adapter.fetchRecords(clara)).rejects.toThrow('robots.txt');
    expect(requests.map(pathOf)).toEqual(['/robots.txt']);
  });
});
