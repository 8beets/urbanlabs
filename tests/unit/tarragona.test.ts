import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createTarragonaAdapter,
  parseTarragonaActivity,
} from '../../src/lib/ingestion/adapters/tarragona-centres-civics';
import { assertRobotsAllowAll } from '../../src/lib/ingestion/robots';
import { courseRecordSchema } from '../../src/lib/ingestion/validation/record';
import { centres } from '../../src/lib/centres/registry';
import { toSourceConfig } from '../../src/lib/centres/schema';

const fixture = (name: string) =>
  readFileSync(new URL(`../fixtures/${name}.html`, import.meta.url), 'utf8');
const paid = fixture('tarragona-activity-paid');
const free = fixture('tarragona-activity-free');
const url =
  'https://inscripcions.tarragona.cat/ca/taller-daquarella-c2t26ac1ap';

const bonavista = toSourceConfig(
  centres.find((c) => c.id === 'cc-tgn-bonavista')!,
);

describe('Tarragona activity pages', () => {
  it('parses a real paid workshop with dates, times and base price', () => {
    const { centreName, ...record } = parseTarragonaActivity(
      paid,
      url,
      'Arts plàstiques',
    );
    expect(centreName).toBe('Centre Cívic Bonavista');
    expect(record).toMatchObject({
      externalId: 'taller-daquarella-c2t26ac1ap',
      title: 'TALLER D’AQUAREL·LA',
      category: 'Arts plàstiques',
      startDate: '2026-10-05',
      endDate: '2026-11-30',
      scheduleText: '16:45 h - 18:15 h',
      priceCents: 6850,
      currency: 'EUR',
      isCancelled: false,
      isSoldOut: false,
    });
    expect(courseRecordSchema.safeParse(record).success).toBe(true);
  });
  it('reads an explicit "Gratuït" price as zero', () => {
    const record = parseTarragonaActivity(free, url, null);
    expect(record.priceCents).toBe(0);
    expect(record.currency).toBe('EUR');
    expect(record.centreName).toBe('Centre Cívic Sant Pere i Sant Pau');
  });
  it('keeps unreadable dates and prices unknown and rejects changed pages', () => {
    const odd = paid
      .replace('Dilluns 05 octubre 2026 - Dilluns 30 novembre 2026', 'aviat')
      .replace('68.5€', 'consulteu');
    const record = parseTarragonaActivity(odd, url, null);
    expect(record.startDate).toBeNull();
    expect(record.endDate).toBeNull();
    expect(record.priceCents).toBeNull();
    expect(record.currency).toBeNull();
    expect(() => parseTarragonaActivity('<html></html>', url, null)).toThrow(
      'structured event data',
    );
    expect(() =>
      parseTarragonaActivity(paid.replaceAll('Data i hora', 'Quan'), url, null),
    ).toThrow('structure changed');
  });
});

describe('robots.txt policy', () => {
  const generic =
    'User-agent: *\nDisallow:\n\nUser-Agent: Googlebot\nDisallow: /*search\n';
  it('accepts a policy that only restricts named agents', () => {
    expect(() => assertRobotsAllowAll(generic)).not.toThrow();
    expect(() => assertRobotsAllowAll('')).not.toThrow();
  });
  it('rejects restrictions on generic crawlers', () => {
    expect(() => assertRobotsAllowAll('User-agent: *\nDisallow: /')).toThrow(
      'robots.txt',
    );
    expect(() =>
      assertRobotsAllowAll('User-agent: Foo\nUser-agent: *\nDisallow: /cursos'),
    ).toThrow('robots.txt');
  });
});

describe('Tarragona fetching', () => {
  const run = (overrides: Record<string, string | null> = {}) => {
    const requests: string[] = [];
    const adapter = createTarragonaAdapter({
      intervalMs: 0,
      sleep: async () => {},
      fetch: async (input) => {
        const target = String(input);
        requests.push(target);
        if (target in overrides) {
          const body = overrides[target];
          return body === null
            ? new Response('', { status: 404 })
            : new Response(body, { status: 200 });
        }
        const { hostname, pathname } = new URL(target);
        if (pathname === '/robots.txt')
          return hostname === 'www.tarragona.cat'
            ? new Response('User-agent: *\nDisallow:\n', { status: 200 })
            : new Response('', { status: 404 });
        if (pathname.endsWith('/activitats-i-cursos/activitats-i-cursos'))
          return new Response(fixture('tarragona-index'));
        if (pathname.endsWith('/activitats-i-cursos-monografics'))
          return new Response(fixture('tarragona-catalogue'));
        if (hostname === 'www.tarragona.cat')
          return new Response(fixture('tarragona-category-arts'));
        if (pathname.endsWith('-c2t26ac1ap')) return new Response(paid);
        return new Response('not saved', { status: 500 });
      },
    });
    return { adapter, requests };
  };
  it('follows the newest catalogue to the centre’s own activity pages only', async () => {
    const { adapter, requests } = run();
    const records = await adapter.fetchRecords(bonavista);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      externalId: 'taller-daquarella-c2t26ac1ap',
      // The saved category page is served for every category: the first one wins.
      category: 'Arts escèniques i expressió cultural',
    });
    // Only c2 (Bonavista) activity pages are requested, never another centre's.
    const details = requests.filter((r) =>
      r.startsWith('https://inscripcions.tarragona.cat/ca/'),
    );
    expect(details).toEqual([url]);
    expect(
      requests.every((r) =>
        /^https:\/\/(www|inscripcions)\.tarragona\.cat\//.test(r),
      ),
    ).toBe(true);
  });
  it('fails safely on a stricter robots policy, a wrong centre or an empty result', async () => {
    await expect(
      run({
        'https://www.tarragona.cat/robots.txt': 'User-agent: *\nDisallow: /',
      }).adapter.fetchRecords(bonavista),
    ).rejects.toThrow('robots.txt');
    await expect(
      run().adapter.fetchRecords({
        ...bonavista,
        institution: { ...bonavista.institution, name: 'Centre Cívic Llevant' },
      }),
    ).rejects.toThrow('belongs to Centre Cívic Bonavista');
    await expect(
      run().adapter.fetchRecords({ ...bonavista, centreCode: 5 }),
    ).rejects.toThrow('No course records');
    await expect(
      run({
        'https://www.tarragona.cat/centrescivics/activitats-i-cursos/activitats-i-cursos':
          '<html></html>',
      }).adapter.fetchRecords(bonavista),
    ).rejects.toThrow('catalogue page not found');
  });
});
