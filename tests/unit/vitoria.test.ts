import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createVitoriaAdapter,
  currentSeason,
  normalTariffCents,
  parseActivityGroups,
  parseCentreActivities,
  parseVitoriaGroup,
} from '../../src/lib/ingestion/adapters/vitoria-gasteiz-actividades';
import { courseRecordSchema } from '../../src/lib/ingestion/validation/record';
import { centres } from '../../src/lib/centres/registry';
import { toSourceConfig } from '../../src/lib/centres/schema';
import { sources } from '../../src/lib/sources';

const fixture = (name: string) =>
  readFileSync(
    new URL(`../fixtures/vitoria-${name}.html`, import.meta.url),
    'utf8',
  );
const iparralde = toSourceConfig(
  centres.find((c) => c.id === 'cc-vit-iparralde')!,
);
const ORIGIN = 'https://sedeelectronica.vitoria-gasteiz.org';
const group = (id: string) =>
  parseActivityGroups(fixture(`groups-${id.split('||')[2]}`)).groups.find(
    (g) => g.id === id,
  )!;

describe('Vitoria-Gasteiz activity search', () => {
  it('is paused until the Ayuntamiento allows reuse', () => {
    const vitoria = centres.filter((c) => c.cityId === 'vitoria-gasteiz');
    expect(vitoria).toHaveLength(14);
    expect(vitoria.every((c) => c.pausedReason)).toBe(true);
    expect(
      sources.some((s) => s.platform === 'vitoria-gasteiz-actividades'),
    ).toBe(false);
  });

  it('reads the current season and the centre’s activities', () => {
    expect(currentSeason(fixture('inicio'))).toBe(2026);
    const activities = parseCentreActivities(fixture('centre-4'), 4);
    expect(activities.length).toBeGreaterThan(50);
    expect(activities).toContain(
      '/m01-10s/actividadAction.do?accion=verCentros&cen=4&activ=AGIA&anio=2026',
    );
    expect(parseCentreActivities(fixture('centre-4'), 5)).toEqual([]);
  });

  it('lists the groups of an activity with their detail pages', () => {
    const page = parseActivityGroups(fixture('groups-AGIA'));
    expect(page.groups.map((g) => g.id)).toEqual([
      '2026||4||AGIA||2||1',
      '2026||4||AGIA||3||1',
      '2026||4||AGIA||1||1',
    ]);
    expect(page).toMatchObject({ total: 3, next: null });
    expect(page.groups.every((g) => !g.cancelled)).toBe(true);
  });

  it('pages through activities with more than 20 groups', () => {
    const first = parseActivityGroups(fixture('groups-FAMN'));
    expect(first).toMatchObject({
      total: 24,
      next: '/m01-10s/actividadAction.do?accion=verCentros&cen=4&activ=FAMN&anio=2026&nuevaPag=2',
    });
    expect(first.groups).toHaveLength(20);
    const second = parseActivityGroups(fixture('groups-FAMN-2'));
    expect(second).toMatchObject({ total: 24, next: null });
    expect(second.groups).toHaveLength(4);
  });

  it('maps a group with its period, weekdays, normal tariff and places', () => {
    const record = parseVitoriaGroup(
      fixture('detail-2026-4-FOCA-1-2'),
      group('2026||4||FOCA||1||2'),
      iparralde,
    );
    expect(courseRecordSchema.safeParse(record).success).toBe(true);
    expect(record).toEqual({
      externalId: '2026-4-FOCA-1-2',
      title: 'Fotografía de calle',
      officialUrl: `${ORIGIN}/m01-10s/actividadAction.do?accion=verCentros&cen=4&activ=FOCA&detalle=detalle&id=2026%7C%7C4%7C%7CFOCA%7C%7C1%7C%7C2&anio=2026&nuevaPag=1`,
      category: null,
      startDate: '2027-01-09',
      endDate: '2027-03-20',
      scheduleText: 'sábado · 11:00 - 13:00',
      priceCents: 5170,
      currency: 'EUR',
      availability: null,
      isCancelled: false,
      isSoldOut: true,
      courseLanguage: null,
    });
  });

  it('keeps unknown free places unknown and names two weekdays', () => {
    const record = parseVitoriaGroup(
      fixture('detail-2026-4-AGIA-2-1'),
      group('2026||4||AGIA||2||1'),
      iparralde,
    );
    expect(record).toMatchObject({
      scheduleText: 'martes y jueves · 19:00 - 19:45',
      priceCents: 3319,
      isSoldOut: false,
    });
  });

  it('lists three weekdays as a Spanish list and keeps unknown codes', () => {
    const html = fixture('detail-2026-4-AGIA-2-1');
    const at = (days: string) =>
      parseVitoriaGroup(
        html.replace('<dd>M-J</dd>', `<dd>${days}</dd>`),
        group('2026||4||AGIA||2||1'),
        iparralde,
      ).scheduleText;
    expect(at('L-X-V')).toBe('lunes, miércoles y viernes · 19:00 - 19:45');
    expect(at('L-Q')).toBe('L-Q · 19:00 - 19:45');
  });

  it('uses only the normal tariff for joining on the first day', () => {
    const html = fixture('detail-2026-4-BATC-1-1');
    expect(normalTariffCents(html, '2026-11-21')).toBe(646);
    // Another start date means the first column is not the whole course.
    expect(normalTariffCents(html, '2026-11-20')).toBeNull();
    expect(
      normalTariffCents(html.replace('TARIFA NORMAL', 'TARIFA'), '2026-11-21'),
    ).toBeNull();
  });

  it('rejects a detail page for another centre', () => {
    expect(() =>
      parseVitoriaGroup(
        fixture('detail-2026-4-BATC-1-1'),
        group('2026||4||BATC||1||1'),
        { ...iparralde, venue: 'C.C. LAKUA' },
      ),
    ).toThrow('is not at C.C. LAKUA');
  });
});

describe('Vitoria-Gasteiz adapter', () => {
  const pages: Record<string, string> = {
    '/portal/robots.txt':
      'User-Agent: *\nDisallow: /j07-01s/J07GetFileServlet?\nDisallow: /cas/login?\n',
    '/m01-10s/actividadAction.do?accion=inicio': fixture('inicio'),
    // Only three of the centre's activities, served from saved pages.
    '/m01-10s/actividadAction.do?accion=verCentros&cen=4&anio=2026':
      '<ul class="listaDosColumnas">' +
      ['AGIA', 'FOCA', 'BATC', 'FAMN']
        .map(
          (a) =>
            `<li><a href="/m01-10s/actividadAction.do?accion=verCentros&amp;cen=4&amp;activ=${a}&amp;anio=2026">${a}</a></li>`,
        )
        .join('') +
      '</ul>',
    '/m01-10s/actividadAction.do?accion=verCentros&cen=4&activ=FAMN&anio=2026&nuevaPag=2':
      fixture('groups-FAMN-2'),
    ...Object.fromEntries(
      ['AGIA', 'FOCA', 'BATC', 'FAMN'].map((a) => [
        `/m01-10s/actividadAction.do?accion=verCentros&cen=4&activ=${a}&anio=2026`,
        fixture(`groups-${a}`),
      ]),
    ),
  };
  const detail = (id: string) => {
    try {
      return fixture(`detail-${id}`);
    } catch {
      // Groups without a saved page reuse a sibling of the same activity.
      return fixture(`detail-2026-4-AGIA-2-1`);
    }
  };
  const run = (overrides: Record<string, string> = {}) => {
    const requests: string[] = [];
    const adapter = createVitoriaAdapter({
      intervalMs: 0,
      sleep: async () => {},
      fetch: async (input) => {
        const url = new URL(String(input));
        const path = url.pathname + url.search;
        requests.push(path);
        const id = url.searchParams.get('id');
        const body =
          overrides[path] ??
          pages[path] ??
          (id ? detail(id.replaceAll('||', '-')) : undefined);
        return body === undefined
          ? new Response('', { status: 404 })
          : new Response(body);
      },
    });
    return { adapter, requests };
  };

  it('fetches every group of the centre’s activities, across pages', async () => {
    const { adapter, requests } = run();
    const records = await adapter.fetchRecords(iparralde);
    expect(records).toHaveLength(5 + 24);
    expect(records.map((r) => r.externalId)).toEqual(
      expect.arrayContaining([
        '2026-4-AGIA-1-1',
        '2026-4-BATC-1-1',
        '2026-4-FOCA-1-2',
        '2026-4-FAMN-1-1',
      ]),
    );
    expect(records.every((r) => courseRecordSchema.safeParse(r).success)).toBe(
      true,
    );
    expect(requests.every((path) => !path.startsWith('/cas/'))).toBe(true);
  });

  it('rejects an activity whose group pages are incomplete', async () => {
    await expect(
      run({
        '/m01-10s/actividadAction.do?accion=verCentros&cen=4&activ=FAMN&anio=2026&nuevaPag=2':
          fixture('groups-AGIA'),
      }).adapter.fetchRecords(iparralde),
    ).rejects.toThrow('incomplete');
  });

  it('honours robots.txt and needs the centre’s listing', async () => {
    await expect(
      run({
        '/portal/robots.txt': 'User-agent: *\nDisallow: /m01-10s/\n',
      }).adapter.fetchRecords(iparralde),
    ).rejects.toThrow('robots.txt');
    await expect(
      run({
        '/m01-10s/actividadAction.do?accion=verCentros&cen=4&anio=2026':
          '<html></html>',
      }).adapter.fetchRecords(iparralde),
    ).rejects.toThrow('No course records');
  });
});
