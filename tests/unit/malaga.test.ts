import { describe, expect, it } from 'vitest';
import { fakeSource, pathOf, readFixture } from '../helpers/source';
import {
  agendaDate,
  agendaPath,
  agendaPriceCents,
  createMalagaAdapter,
  groupActivities,
  malagaRecord,
  malagaRows,
  plainText,
  venueRecords,
} from '../../src/lib/ingestion/adapters/malaga-datos-agenda';
import { createSourceFetcher } from '../../src/lib/ingestion/http';
import { courseRecordSchema } from '../../src/lib/ingestion/validation/record';
import { centres } from '../../src/lib/centres/registry';
import { toSourceConfig } from '../../src/lib/centres/schema';
import { sources } from '../../src/lib/sources';
import { geographyCity } from '../../src/lib/locations/registry';

const csv = readFixture('malaga-agenda.csv');
const rows = malagaRows(csv);
const library = (slug: string) =>
  toSourceConfig(centres.find((c) => c.slug === slug)!);
const altolaguirre = library(
  'biblioteca-manuel-altolaguirre-cruz-del-humilladero',
);
const cuevas = library('biblioteca-cristobal-cuevas-bailen-miraflores');
const NOV_14 = new Date('2026-11-14T10:00:00Z');

describe('Málaga agenda dataset', () => {
  it('publishes the municipal libraries with the dataset credited', () => {
    const malaga = centres.filter((c) => c.cityId === 'malaga');
    expect(malaga).toHaveLength(12);
    // Two libraries' pages and the city's libraries dataset give different streets.
    expect(malaga.filter((c) => c.pausedReason).map((c) => c.slug)).toEqual([
      'biblioteca-vicente-espinel-puerto-de-la-torre',
      'biblioteca-jorge-guillen-el-perchel',
    ]);
    const active = malaga.filter((c) => !c.pausedReason);
    expect(active.every((c) => c.profile.location)).toBe(true);
    expect(
      sources.filter((s) => s.platform === 'malaga-datos-agenda'),
    ).toHaveLength(10);
    expect(geographyCity('malaga')?.dataCredit).toEqual({
      url: 'https://datosabiertos.malaga.eu/dataset/agenda-2026',
      names: {
        es: 'Ayuntamiento de Málaga – datosabiertos.malaga.eu (CC BY-SA 4.0)',
        ca: 'Ajuntament de Màlaga – datosabiertos.malaga.eu (CC BY-SA 4.0)',
      },
    });
    expect(altolaguirre.centreCode).toBe(116);
    expect(altolaguirre.listingUrl).toBe(altolaguirre.institution.url);
  });

  it('reads the comma CSV with quoted line breaks and checks its columns', () => {
    expect(rows).toHaveLength(7);
    expect(groupActivities(rows).map((g) => g[0]!.ID_ACTIVIDAD)).toEqual([
      '148583',
      '149545',
      '149694',
      '149701',
      '149705',
    ]);
    expect(() => malagaRows('ID_ACTIVIDAD,NOMBRE\n1,a\n')).toThrow(
      'lacks column',
    );
    expect(() =>
      groupActivities([{ ...rows[0]!, ID_ACTIVIDAD: 'x1' }]),
    ).toThrow('not numeric');
  });

  it('reads local dates only in the dataset form', () => {
    expect(agendaDate('25/11/2026 00:00:00')).toBe('2026-11-25');
    expect(agendaDate('31/02/2026 00:00:00')).toBeNull();
    expect(agendaDate('25/11/2026')).toBeNull();
    expect(agendaDate('06-JUL-26')).toBeNull();
  });

  it('treats only an explicit "Gratuito" as a price', () => {
    expect(agendaPriceCents('Gratuito')).toBe(0);
    expect(agendaPriceCents('Gratuito. Previa Inscripción')).toBe(0);
    expect(agendaPriceCents('Precios:  Gratuito con inscripción previa')).toBe(
      0,
    );
    expect(agendaPriceCents('Entrada libre hasta completar aforo')).toBeNull();
    expect(agendaPriceCents('Gratuitos')).toBeNull();
    expect(agendaPriceCents('')).toBeNull();
  });

  it('turns HTML fields into plain text', () => {
    expect(plainText('<b>MICKEY MAGIC FEST</b>')).toBe('MICKEY MAGIC FEST');
    expect(plainText('Sábados de 11:30 a 13:00 horas.<br>   ')).toBe(
      'Sábados de 11:30 a 13:00 horas.',
    );
  });

  it("maps a library course without the dataset's contact fields", () => {
    const [record] = venueRecords(rows, altolaguirre);
    expect(courseRecordSchema.safeParse(record).success).toBe(true);
    expect(record).toEqual({
      externalId: '149694',
      title: 'Taller de Poesía. B.P.M. Manuel Altolaguirre',
      officialUrl: altolaguirre.institution.url,
      category: null,
      startDate: '2026-11-25',
      endDate: '2026-11-25',
      scheduleText: '18:00 horas',
      priceCents: 0,
      currency: 'EUR',
      availability: null,
      isCancelled: false,
      isSoldOut: false,
      courseLanguage: null,
    });
    expect(JSON.stringify(record)).not.toContain('@');
  });

  it('keeps one record for an activity listed under two specialties', () => {
    const records = venueRecords(rows, cuevas);
    expect(records.map((r) => r.externalId)).toEqual(['149701']);
    expect(records[0]!.priceCents).toBe(0);
  });

  it('leaves values unknown when the rows of one activity disagree', () => {
    const chess = rows.filter((r) => r.ID_ACTIVIDAD === '149701');
    const record = malagaRecord(
      [chess[0]!, { ...chess[1]!, F_INICIO: '11/11/2026 00:00:00' }],
      cuevas,
    );
    expect(record.startDate).toBeNull();
    expect(record.endDate).toBe('2026-11-18');
    expect(record.priceCents).toBe(0);
  });

  it('ignores online courses, ad hoc places and non-course activities', () => {
    const at = (centreCode: number) =>
      venueRecords(rows, { ...altolaguirre, centreCode });
    // Online course 148583 and the MUCAC workshop have ID_LUGAR 0.
    expect(() => at(0)).toThrow('no venue id');
    // A show at La Caja Blanca (2770) is not a course.
    expect(at(2770)).toEqual([]);
  });
});

describe('Málaga adapter', () => {
  const run = (robots: string | null, now = NOV_14) => {
    const { options, requests } = fakeSource((url) => {
      const path = pathOf(url.href);
      if (path === '/robots.txt') return robots;
      if (path === agendaPath('2026')) return csv;
      return null;
    });
    return { adapter: createMalagaAdapter(options, () => now), requests };
  };
  const ROBOTS =
    'User-agent: *\nDisallow: /dataset/rate/\nDisallow: /api/\nCrawl-Delay: 10\n';

  it("reads the current year's file once robots.txt allows it", async () => {
    const { adapter, requests } = run(ROBOTS);
    expect(
      (await adapter.fetchRecords(altolaguirre)).map((r) => r.externalId),
    ).toEqual(['149694']);
    expect(requests.map(pathOf)).toEqual([
      '/robots.txt',
      '/recursos/cultura/agenda/2026.csv',
    ]);
  });

  it('stops when robots.txt disallows the file', async () => {
    const { adapter, requests } = run('User-agent: *\nDisallow: /recursos/\n');
    await expect(adapter.fetchRecords(altolaguirre)).rejects.toThrow(
      'robots.txt',
    );
    expect(requests.map(pathOf)).toEqual(['/robots.txt']);
  });

  it("uses the venue's local year and fails when that file is missing", async () => {
    const { adapter, requests } = run(ROBOTS, new Date('2026-12-31T23:30:00Z'));
    await expect(adapter.fetchRecords(altolaguirre)).rejects.toThrow('404');
    expect(requests.map(pathOf)).toContain('/recursos/cultura/agenda/2027.csv');
  });

  it('accepts an empty venue only when it may be empty (the file resets each January)', async () => {
    const { adapter } = run(ROBOTS);
    const huelin = library('biblioteca-maria-zambrano-huelin');
    expect(huelin.mayBeEmpty).toBe(true);
    expect(await adapter.fetchRecords(huelin)).toEqual([]);
    await expect(
      adapter.fetchRecords({ ...huelin, mayBeEmpty: false }),
    ).rejects.toThrow('No course records');
  });
});

describe('source response size limit', () => {
  it('rejects a response over the configured limit', async () => {
    const { options } = fakeSource(() => 'x'.repeat(20));
    const site = createSourceFetcher('https://datosabiertos.malaga.eu', {
      ...options,
      maxBytes: 10,
    });
    await expect(
      site('https://datosabiertos.malaga.eu/recursos/a.csv'),
    ).rejects.toThrow('0.00001 MB limit');
  });
});
