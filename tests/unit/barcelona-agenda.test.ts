import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fakeSource, pathOf } from '../helpers/source';
import {
  agendaDate,
  agendaPriceCents,
  agendaSchedule,
  assertRecentSnapshot,
  barcelonaRows,
  createBarcelonaAgendaAdapter,
  groupEvents,
  MIRROR_PATH,
  timetableRows,
  venueRecords,
} from '../../src/lib/ingestion/adapters/barcelona-agenda';
import { createSourceFetcher } from '../../src/lib/ingestion/http';
import { courseRecordSchema } from '../../src/lib/ingestion/validation/record';
import { centres } from '../../src/lib/centres/registry';
import { toSourceConfig } from '../../src/lib/centres/schema';
import { sources } from '../../src/lib/sources';

// The mirror's own bytes: UTF-16LE with a BOM, CRLF rows.
const bytes = readFileSync(
  new URL('../fixtures/barcelona-agenda.csv', import.meta.url),
);
const csv = new TextDecoder('utf-16le').decode(bytes);
const rows = barcelonaRows(csv);
const venue = (slug: string) =>
  toSourceConfig(centres.find((c) => c.slug === slug)!);
const sagrera = venue('casal-de-barri-comunitari-torre-de-la-sagrera');
const NOV_24 = new Date('2026-11-24T10:00:00Z');

describe('Barcelona agenda dataset', () => {
  it('registers the casals, libraries, museums and ateneus by their place names', () => {
    const agenda = centres.filter(
      (c) => c.registration.platform === 'barcelona-agenda',
    );
    expect(agenda).toHaveLength(68);
    expect(agenda.some((c) => c.pausedReason)).toBe(false);
    expect(agenda.every((c) => c.profile.location && !c.profile.phone)).toBe(
      true,
    );
    expect(
      sources.filter((s) => s.platform === 'barcelona-agenda'),
    ).toHaveLength(68);
    // One agenda spelling belongs to one venue only.
    const places = agenda.flatMap((c) =>
      c.registration.platform === 'barcelona-agenda'
        ? c.registration.places
        : [],
    );
    expect(new Set(places).size).toBe(places.length);
    expect(sagrera.listingUrl).toBe(sagrera.institution.url);
    expect(sagrera.venues).toEqual([
      'Casal de Barri Comunitari Torre de la Sagrera',
      'Casal de Barri Torre de la Sagrera',
    ]);
  });

  it('reads the CSV, groups rows by event and drops the ids’ stray BOM', () => {
    expect(rows).toHaveLength(123);
    expect(rows[0]!.register_id.startsWith('\ufeff')).toBe(true);
    expect(groupEvents(rows).map((g) => g[0]!.register_id)).toEqual([
      '99400761536',
      '99400746347',
      '99400746801',
      '99400742722',
      '99400705101',
      '99400784067',
    ]);
    expect(() => barcelonaRows('register_id,name\r\n1,a\r\n')).toThrow(
      'lacks column',
    );
    expect(() => groupEvents([{ ...rows[0]!, register_id: 'x1' }])).toThrow(
      'not numeric',
    );
  });

  it('reads local dates from the agenda form only', () => {
    expect(agendaDate('2026-09-30T03:00:00+02:00')).toBe('2026-09-30');
    expect(agendaDate('2026-12-09T03:00:00+01:00')).toBe('2026-12-09');
    expect(agendaDate('2026-02-31T03:00:00+01:00')).toBeNull();
    expect(agendaDate('')).toBeNull();
  });

  it('repeats timetable cells that span rows', () => {
    const event = rows.find((r) => r.register_id.endsWith('99400761536'))!;
    const timetable = timetableRows(event.timetable);
    expect(timetable.map((r) => [r.day, r.hour])).toEqual([
      ['Dimecres', 'de 10.15 h a 11.15 h'],
      ['Dimecres', 'de 16.30 h a 17.30 h'],
      ['Dimecres', 'de 17.30 h a 18.30 h'],
      ['Dimecres', 'de 18.30 h a 19.30 h'],
    ]);
    expect(timetable.every((r) => r.price.startsWith('Entrada general'))).toBe(
      true,
    );
    expect(agendaSchedule(timetable)).toBe(
      'Dimecres de 10.15 h a 11.15 h; Dimecres de 16.30 h a 17.30 h; Dimecres de 17.30 h a 18.30 h; Dimecres de 18.30 h a 19.30 h',
    );
    expect(agendaSchedule(timetableRows(''))).toBeNull();
    expect(agendaSchedule(Array(80).fill(timetable[0]!))).toBeNull();
  });

  it('keeps only an explicit base price', () => {
    expect(agendaPriceCents('Entrada Gratuïta')).toBe(0);
    expect(agendaPriceCents('Entrada Gratuïta Cal inscripció')).toBe(0);
    // A supplement is not represented; the base entry is free.
    expect(
      agendaPriceCents('Entrada Gratuïta + Suplement per ingredients'),
    ).toBe(0);
    expect(agendaPriceCents('Entrada general: 62.05 € Reducció…')).toBe(6205);
    expect(agendaPriceCents('Entrada general: 4.5 €')).toBe(450);
    expect(agendaPriceCents('Entrada general: 2,25 €')).toBe(225);
    expect(agendaPriceCents('Entrada general de: 8.08 a 26.89 €')).toBeNull();
    expect(agendaPriceCents('Entrada general: 20 € mensual')).toBeNull();
    expect(agendaPriceCents('Entrada general: 30 € /any')).toBeNull();
    expect(agendaPriceCents('Entrada gratuïta')).toBeNull();
    expect(agendaPriceCents('')).toBeNull();
  });

  it('maps a course with its guide page, dates, schedule and price', () => {
    const [record] = venueRecords(rows, sagrera);
    expect(courseRecordSchema.safeParse(record).success).toBe(true);
    expect(record).toEqual({
      externalId: '99400761536',
      title: "Taller 'Estimulació musical'",
      officialUrl: 'https://guia.barcelona.cat/ca/detall/_99400761536.html',
      category: null,
      startDate: '2026-09-30',
      endDate: '2026-12-09',
      scheduleText:
        'Dimecres de 10.15 h a 11.15 h; Dimecres de 16.30 h a 17.30 h; Dimecres de 17.30 h a 18.30 h; Dimecres de 18.30 h a 19.30 h',
      priceCents: 6205,
      currency: 'EUR',
      availability: null,
      isCancelled: false,
      isSoldOut: false,
      courseLanguage: null,
    });
  });

  it('matches every spelling of a venue and ignores blank places', () => {
    const vinya = venueRecords(
      rows,
      venue('casal-de-barri-comunitari-la-vinya'),
    );
    expect(vinya.map((r) => [r.externalId, r.priceCents])).toEqual([
      // Its fee is "20 € mensual", a monthly fee, so the price stays unknown.
      ['99400742722', null],
    ]);
  });

  it('leaves out events also held at another venue', () => {
    expect(
      venueRecords(
        rows,
        venue('casal-de-barri-comunitari-can-travi-de-la-vall-d-hebron'),
      ),
    ).toEqual([]);
  });

  it('leaves a price range and a missing end date unknown', () => {
    const [range] = venueRecords(
      rows,
      venue('espai-de-persones-grans-de-sant-genis-dels-agudells'),
    );
    expect([range!.priceCents, range!.currency]).toEqual([null, null]);
    const [open] = venueRecords(
      rows,
      venue('museu-de-ciencies-naturals-de-barcelona'),
    );
    expect([open!.startDate, open!.endDate]).toEqual(['2023-01-07', null]);
  });

  it('fails on an old copy', () => {
    expect(() => assertRecentSnapshot(rows, NOV_24)).not.toThrow();
    expect(() =>
      assertRecentSnapshot(rows, new Date('2027-01-15T10:00:00Z')),
    ).toThrow('days old');
    expect(() =>
      assertRecentSnapshot([{ ...rows[0]!, modified: '' }], NOV_24),
    ).toThrow('no readable modified');
  });
});

describe('Barcelona agenda adapter', () => {
  const run = (now = NOV_24) => {
    const { options, requests } = fakeSource((url) =>
      pathOf(url.href) === MIRROR_PATH ? new Response(bytes) : null,
    );
    return {
      adapter: createBarcelonaAgendaAdapter(options, () => now),
      requests,
    };
  };

  it('reads the UTF-16 mirror from raw.githubusercontent.com', async () => {
    const { adapter, requests } = run();
    expect(
      (await adapter.fetchRecords(sagrera)).map((r) => r.externalId),
    ).toEqual(['99400761536']);
    expect(requests).toEqual([
      `https://raw.githubusercontent.com${MIRROR_PATH}`,
    ]);
  });

  it('accepts an empty venue only when it may be empty', async () => {
    const { adapter } = run();
    const empty = venue('biblioteca-jaume-fuster');
    expect(empty.mayBeEmpty).toBe(true);
    expect(await adapter.fetchRecords(empty)).toEqual([]);
    await expect(
      adapter.fetchRecords({ ...empty, mayBeEmpty: false }),
    ).rejects.toThrow('No course records');
    await expect(
      adapter.fetchRecords({ ...empty, venues: [] }),
    ).rejects.toThrow('no places');
  });

  it('fails when the copy has not been refreshed for over a month', async () => {
    const { adapter } = run(new Date('2027-01-15T10:00:00Z'));
    await expect(adapter.fetchRecords(sagrera)).rejects.toThrow('regenerate');
  });
});

describe('source response encoding', () => {
  it('decodes a UTF-16LE body and drops its BOM', async () => {
    const body = new Uint8Array([0xff, 0xfe, 0x61, 0x00, 0xe0, 0x00]);
    const { options } = fakeSource(() => new Response(body));
    const site = createSourceFetcher('https://raw.githubusercontent.com', {
      ...options,
      encoding: 'utf-16le',
    });
    expect(await site('https://raw.githubusercontent.com/a.csv')).toBe('aà');
  });
});
