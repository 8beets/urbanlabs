import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createMiramAdapter,
  parseMiramPage,
} from '../../src/lib/ingestion/adapters/miram';
import {
  parseDateRange,
  parseEuroPrice,
} from '../../src/lib/ingestion/normalization/values';
import { createSourceFetcher } from '../../src/lib/ingestion/http';
import { santAndreu } from '../../src/lib/sources/sant-andreu';
import { golferichs } from '../../src/lib/sources/golferichs';
import { categoryLabel } from '../../src/i18n/ui';
import { parseFilters } from '../../src/lib/courses/discovery';

const fixture = readFileSync(
  new URL('../fixtures/miram-sant-andreu-languages.html', import.meta.url),
  'utf8',
);
const url = `${santAndreu.listingUrl}&f=ID`;

describe('Miram source fixture', () => {
  it('omits explicitly unpublished previews without inventing an external ID or dates', () => {
    const html = readFileSync(
      new URL('../fixtures/miram-urania-unpublished.html', import.meta.url),
      'utf8',
    );
    expect(parseMiramPage(html, url)).toMatchObject({
      records: [],
      unpublishedPreviews: 1,
    });
    expect(() =>
      parseMiramPage(
        html.replace('Podreu realitzar', 'Unexpected layout'),
        url,
      ),
    ).toThrow('identifier');
  });
  it('extracts the explicit free price and single date of a real family cooking workshop', () => {
    const html = readFileSync(
      new URL('../fixtures/miram-sortidor-family.html', import.meta.url),
      'utf8',
    );
    expect(parseMiramPage(html, url).records[0]).toMatchObject({
      externalId: '3412',
      title: 'Fem galetes de gingebre per Nadal!',
      startDate: '2026-12-11',
      endDate: '2026-12-11',
      priceCents: 0,
      currency: 'EUR',
      availability: null,
    });
  });
  it('extracts actual Golferichs photography facts without changing their source category', () => {
    const html = readFileSync(
      new URL('../fixtures/miram-golferichs-photography.html', import.meta.url),
      'utf8',
    );
    const { records } = parseMiramPage(html, `${golferichs.listingUrl}&f=XX`);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      externalId: '7350',
      title: 'Tècniques bàsiques (1r nivell): coneixement de la càmera',
      category: 'Espai de fotografia F. Català-Roca',
      startDate: '2026-09-21',
      endDate: '2026-11-16',
      priceCents: 9332,
      availability: null,
    });
    expect(records[0]?.officialUrl).toBe(
      `${golferichs.listingUrl}&f=XX#accordion7350`,
    );
    expect(categoryLabel(records[0]!.category!, 'es')).toBe('Fotografía');
  });
  it('extracts Golferichs cooking with its base price and localized category label', () => {
    const html = readFileSync(
      new URL('../fixtures/miram-golferichs-cooking.html', import.meta.url),
      'utf8',
    );
    const { records } = parseMiramPage(html, `${golferichs.listingUrl}&f=CU`);
    expect(records[0]).toMatchObject({
      externalId: '7284',
      title: 'Cuina i maridatge. Sorprèn a la colla',
      category: 'Cuina',
      startDate: '2026-10-13',
      endDate: '2026-11-24',
      priceCents: 8165,
      availability: null,
    });
    expect(categoryLabel(records[0]!.category!, 'es')).toBe('Cocina');
  });
  it('extracts Pati Llimona course facts with the shared parser', () => {
    const html = readFileSync(
      new URL('../fixtures/miram-pati-llimona-cinema.html', import.meta.url),
      'utf8',
    );
    const { records } = parseMiramPage(
      html,
      'https://patillimona.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=1&t=AC&f=2',
    );
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      externalId: '5005',
      title: 'Darrere de la pantalla - Secrets, trucs i eines del cinema',
      category: 'CINEMA',
      priceCents: 7531,
      startDate: '2026-10-01',
      endDate: '2026-11-19',
    });
  });
  it('discovers actual unstyled Miram pagination links and trims category labels', () => {
    const html = readFileSync(
      new URL(
        '../fixtures/miram-pati-llimona-pagination.html',
        import.meta.url,
      ),
      'utf8',
    );
    const pageUrl =
      'https://patillimona.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=1&t=AC&f=1';
    const { records, links } = parseMiramPage(html, pageUrl);
    expect(records[0]?.category).toBe('FOTOGRAFIA');
    expect(links).toEqual([
      `${pageUrl}&p=1`,
      `${pageUrl}&p=2`,
      `${pageUrl}&p=3`,
    ]);
  });
  it('reuses the adapter for actual Can Basté markup', () => {
    const html = readFileSync(
      new URL('../fixtures/miram-can-baste-languages.html', import.meta.url),
      'utf8',
    );
    const { records } = parseMiramPage(
      html,
      'https://canbaste.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=30&t=AC&f=07',
    );
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      externalId: '3825',
      title: 'ANGLÈS CONTINUACIÓ',
      category: 'IDIOMES',
      startDate: '2026-09-15',
      endDate: '2026-11-10',
    });
  });
  it('extracts real IDs, base prices, dates, and original titles', () => {
    const { records } = parseMiramPage(fixture, url);
    expect(records).toHaveLength(4);
    expect(records[0]).toMatchObject({
      title: 'CONVERSA EN ANGLÈS',
      externalId: '1725',
      priceCents: 5648,
      currency: 'EUR',
      startDate: '2027-01-14',
      endDate: '2027-03-04',
      availability: null,
      courseLanguage: null,
    });
    expect(records[3]).toMatchObject({ externalId: '1726', priceCents: 1883 });
    expect(records.every((record) => !('description' in record))).toBe(true);
  });
  it('rejects layout changes, empty listings, and missing identity', () => {
    expect(() => parseMiramPage('<html>Login</html>', url)).toThrow(
      'structure changed',
    );
    expect(() =>
      parseMiramPage('<select id="eFamilia"></select>', url),
    ).toThrow('Empty');
    expect(() =>
      parseMiramPage(fixture.replaceAll('accordion', 'changed'), url),
    ).toThrow('identifier');
  });
  it('does not turn an unknown price or date into zero or today', () => {
    const { records } = parseMiramPage(
      fixture
        .replaceAll('Preu:', 'Cost:')
        .replaceAll('de gener', 'mes desconegut'),
      url,
    );
    expect(records[0]?.priceCents).toBeNull();
    expect(records[0]?.startDate).toBeNull();
  });
});

describe('normalization', () => {
  it.each([
    ['Preu: 56,48 € (IVA inclòs)', 5648],
    ['Preu: 0,00 €', 0],
    ['Preu: 1.234,50 €', 123450],
    ['Preu Descompte 50%: 28,24 €', null],
    ['', null],
  ])('parses explicit euro base price %s', (value, expected) => {
    expect(parseEuroPrice(value)).toBe(expected);
  });
  it('does not turn incomplete single-date ranges or ambiguous free-price prose into confirmed facts', () => {
    expect(
      parseDateRange('11 de març de 2026 al 12 de mes desconegut de 2026'),
    ).toEqual([null, null]);
    expect(parseDateRange('31 de febrer de 2026')).toEqual([null, null]);
    expect(parseEuroPrice('Preu: Gratuït per a menors')).toBeNull();
  });
  it('validates calendar dates and leaves local dates independent of DST', () => {
    expect(
      parseDateRange('Del 28 de març de 2027 al 31 de març de 2027'),
    ).toEqual(['2027-03-28', '2027-03-31']);
    expect(
      parseDateRange('Del 29 de febrer de 2027 al 3 de març de 2027'),
    ).toEqual([null, null]);
    expect(
      parseDateRange('Del 4 de març de 2027 al 1 de març de 2027'),
    ).toEqual([null, null]);
  });
  it('bounds and validates search filters', () => {
    expect(
      parseFilters(new URLSearchParams('q=anglès&maxPrice=56.48&page=2')),
    ).toEqual({
      country: 'ES',
      region: '',
      city: '',
      q: 'anglès',
      maxPriceCents: 5648,
      page: 2,
      category: '',
      centre: '',
      cancellation: '',
    });
    for (const query of [
      'page=0',
      'category=%00',
      'centre=%27SQL',
      `category=${'x'.repeat(201)}`,
      'page=1001',
      'page=1.5',
      'maxPrice=-1',
      'maxPrice=NaN',
      `q=${'é'.repeat(21)}`,
    ])
      expect(() => parseFilters(new URLSearchParams(query))).toThrow();
  });
});

describe('bounded fetching', () => {
  it('keeps zero-indexed p=1 distinct and avoids re-fetching the default page as p=0', async () => {
    const source = {
      ...santAndreu,
      listingUrl:
        'https://albareda.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=13&t=AC&f=02',
    };
    const requests: string[] = [];
    const adapter = createMiramAdapter({
      intervalMs: 0,
      sleep: async () => {},
      fetch: async (input) => {
        const requested = String(input);
        requests.push(requested);
        if (requested.endsWith('/robots.txt'))
          return new Response('', { status: 404 });
        const file =
          new URL(requested).searchParams.get('p') === '1' ? 'next' : 'first';
        return new Response(
          readFileSync(
            new URL(
              `../fixtures/miram-albareda-music-${file}.html`,
              import.meta.url,
            ),
            'utf8',
          ),
        );
      },
    });
    expect(
      (await adapter.fetchRecords(source)).map((record) => record.externalId),
    ).toEqual(['2264', '2267']);
    expect(requests).toHaveLength(3);
    expect(requests.some((request) => request.includes('p=1'))).toBe(true);
    expect(requests.some((request) => request.includes('p=0'))).toBe(false);
  });
  it('stops an endless pagination chain at the explicit page bound', async () => {
    let calls = 0;
    const adapter = createMiramAdapter({
      intervalMs: 0,
      sleep: async () => {},
      fetch: async (input) => {
        if (String(input).endsWith('/robots.txt'))
          return new Response('', { status: 404 });
        calls++;
        return new Response(
          `${fixture}<a rel="next" href="${santAndreu.listingUrl}&p=${calls}">next</a>`,
        );
      },
    });
    await expect(adapter.fetchRecords(santAndreu)).rejects.toThrow(
      '60-page limit',
    );
    expect(calls).toBe(60);
  });
  it('excludes reviewed non-course records using institution configuration', async () => {
    const adapter = createMiramAdapter({
      intervalMs: 0,
      sleep: async () => {},
      fetch: async (input) =>
        String(input).endsWith('/robots.txt')
          ? new Response('', { status: 404 })
          : new Response(fixture),
    });
    const records = await adapter.fetchRecords({
      ...santAndreu,
      excludedExternalIds: ['1725'],
    });
    expect(records).toHaveLength(3);
    expect(records.some((record) => record.externalId === '1725')).toBe(false);
  });
  it('retries a rate limit and respects Retry-After', async () => {
    const delays: number[] = [];
    let requests = 0;
    const get = createSourceFetcher('https://example.org', {
      intervalMs: 0,
      sleep: async (ms) => {
        delays.push(ms);
      },
      fetch: async () =>
        ++requests === 1
          ? new Response('', { status: 429, headers: { 'retry-after': '2' } })
          : new Response('ok'),
    });
    expect(await get('https://example.org/list')).toBe('ok');
    expect(delays).toContain(2000);
    await expect(get('https://other.example.org/')).rejects.toThrow(
      'approved origin',
    );
  });
  it('bounds retries and refuses oversized responses', async () => {
    let calls = 0;
    const options = { intervalMs: 0, sleep: async () => {} };
    const get = createSourceFetcher('https://example.org', {
      ...options,
      fetch: async () => {
        calls++;
        return new Response('', { status: 503 });
      },
    });
    await expect(get('https://example.org/list')).rejects.toThrow('503');
    expect(calls).toBe(3);
    const huge = createSourceFetcher('https://example.org', {
      ...options,
      fetch: async () => new Response('x'.repeat(2_000_001)),
    });
    await expect(huge('https://example.org/list')).rejects.toThrow('2 MB');
  });
  it('follows categories and pagination once, retaining stable identity', async () => {
    const requests: string[] = [];
    const rootHtml = `<select id="eFamilia"></select><a class="card" href="${url}">IDIOMES</a>`;
    const adapter = createMiramAdapter({
      intervalMs: 0,
      sleep: async () => {},
      fetch: async (input) => {
        const requested = String(input);
        requests.push(requested);
        if (requested.endsWith('/robots.txt'))
          return new Response('', { status: 404 });
        if (requested === santAndreu.listingUrl) return new Response(rootHtml);
        if (requested === url)
          return new Response(
            `${fixture}<a rel="next" href="${url}&p=2">2</a>`,
          );
        return new Response(fixture);
      },
    });
    expect(await adapter.fetchRecords(santAndreu)).toHaveLength(4);
    expect(requests).toHaveLength(4);
  });
  it('fails closed on robots policy changes and external pagination', async () => {
    const adapter = createMiramAdapter({
      intervalMs: 0,
      sleep: async () => {},
      fetch: async () => new Response('User-agent: *\nDisallow: /'),
    });
    await expect(adapter.fetchRecords(santAndreu)).rejects.toThrow(
      'robots.txt',
    );
    const external = createMiramAdapter({
      intervalMs: 0,
      sleep: async () => {},
      fetch: async (input) =>
        String(input).endsWith('/robots.txt')
          ? new Response('', { status: 404 })
          : new Response(
              `${fixture}<a rel="next" href="https://evil.example/">next</a>`,
            ),
    });
    await expect(external.fetchRecords(santAndreu)).rejects.toThrow(
      'approved source',
    );
  });
});
