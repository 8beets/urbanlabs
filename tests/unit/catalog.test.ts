import { describe, expect, it } from 'vitest';
import { courseCardHtml } from '../../src/lib/courses/card';
import { escapeHtml } from '../../src/lib/html';
import { defaultFilters, discover } from '../../src/lib/catalog/discovery';
import { discoveryResultsHtml } from '../../src/lib/catalog/discovery-view';
import { categoryPagesFrom } from '../../src/lib/catalog/pages';
import {
  canonicalListing,
  catalogToday,
  listCourses,
  liveUntil,
} from '../../src/lib/catalog/query';
import {
  DETAIL_CHUNK_SIZE,
  buildSearchIndexes,
  decodeIndexes,
  detailChunksFor,
  withDetails,
} from '../../src/lib/catalog/search-index';
import {
  detailChunkSchema,
  searchIndexSchema,
} from '../../src/lib/catalog/search-index-schema';
import {
  snapshotSchema,
  type Snapshot,
  type SnapshotEdition,
} from '../../src/lib/catalog/types';

// Synthetic fixture data for unit tests only; never published.
function edition(overrides: Partial<SnapshotEdition>): SnapshotEdition {
  return {
    id: 'e1',
    title: 'TEST taller',
    title_reviewed: 0,
    category: 'IDIOMES',
    institution: 'TEST centre',
    institution_id: 'cc-test',
    institution_slug: 'test',
    city_id: 'barcelona',
    start_date: '2099-01-01',
    end_date: '2099-02-01',
    schedule_text: null,
    price_cents: 1000,
    currency: 'EUR',
    is_cancelled: 0,
    is_sold_out: 0,
    organizer: null,
    official_url: 'https://example.org/course',
    last_successfully_verified_at: '2026-11-10T00:00:00.000Z',
    first_seen_at: '2026-11-10T00:00:00.000Z',
    source_id: 'test-source',
    external_id: overrides.id ?? 'e1',
    ...overrides,
  };
}

const snapshot: Snapshot = {
  version: 1,
  generatedAt: '2026-11-11T12:00:00.000Z',
  timeZones: ['Europe/Madrid'],
  geography: {
    countries: [{ code: 'ES', name: 'España' }],
    regions: [{ id: 'catalunya', country_code: 'ES', name: 'Catalunya' }],
    cities: [
      {
        id: 'barcelona',
        country_code: 'ES',
        region_id: 'catalunya',
        name: 'Barcelona',
      },
    ],
  },
  locations: [
    {
      institution_id: 'cc-test',
      country_code: 'ES',
      city_id: 'barcelona',
      region_id: 'catalunya',
    },
  ],
  centres: [],
  map: { mapCentres: [], mapHasMore: false },
  editions: [
    edition({ id: 'live' }),
    edition({ id: 'ended', end_date: '2026-11-01', start_date: '2026-10-01' }),
    edition({ id: 'open-ended', end_date: null, category: 'ESPAI FOTOGRÀFIC' }),
  ],
};

describe('search index files', () => {
  it('split live and past editions at the build date, each edition once', () => {
    const { live, archive, details } = buildSearchIndexes(
      snapshot,
      [],
      '2026-11-11',
      'barcelona',
    );
    expect(searchIndexSchema.parse(live)).toEqual(live);
    expect(detailChunkSchema.parse(details[0])).toEqual(details[0]);
    const ids = (index: typeof live) =>
      decodeIndexes([index]).editions.map((e) => e.id);
    // Live editions come first, in listing order; ended ones follow.
    expect(ids(live)).toEqual(['0000000', '0000001']);
    expect(ids(archive)).toEqual(['0000002']);
    const decoded = decodeIndexes([live, archive]).editions;
    expect(decoded).toHaveLength(3);
    // Filtering fields only, until the card details are joined.
    expect(decoded[0]).toMatchObject({
      official_url: '',
      schedule_text: null,
    });
    const chunks = new Map(details.map((chunk, n) => [n, chunk]));
    expect(detailChunksFor(decoded)).toEqual([0]);
    // Everything a card or filter needs survives; provenance ordering stays behind.
    const dropped = [
      'id',
      'last_successfully_verified_at',
      'first_seen_at',
      'source_id',
      'external_id',
    ];
    const source = snapshot.editions.find((e) => e.id === 'live')!;
    // 'live' and 'open-ended' tie on the start date; the id order breaks the tie.
    const card = withDetails(decoded[0]!, chunks);
    expect(card).toMatchObject({
      ...Object.fromEntries(
        Object.entries(source).filter(([key]) => !dropped.includes(key)),
      ),
      last_successfully_verified_at: '2026-11-10',
    });
    expect(card).not.toHaveProperty('first_seen_at');
  });

  it('order positions like the listing, so a first page needs one detail file', () => {
    const many = {
      ...snapshot,
      editions: Array.from({ length: DETAIL_CHUNK_SIZE + 5 }, (_, i) =>
        edition({
          id: `e${String(i).padStart(3, '0')}`,
          // Later ids start sooner, so listing order differs from id order.
          start_date: `2099-01-${String(28 - (i % 28)).padStart(2, '0')}`,
          end_date: '2099-12-31',
          official_url: `https://example.org/${i}`,
        }),
      ),
    };
    const { live, details } = buildSearchIndexes(
      many,
      [],
      '2026-11-11',
      'barcelona',
    );
    expect(details).toHaveLength(2);
    const catalog = decodeIndexes([live]);
    const page = listCourses(catalog, { ...defaultFilters }, '2026-11-11');
    expect(detailChunksFor(page.courses)).toEqual([0]);
    // Ties on the start date still break by the original id order.
    const chunks = new Map(details.map((chunk, n) => [n, chunk]));
    const urls = page.courses.map((c) => withDetails(c, chunks).official_url);
    const expected = listCourses(
      many,
      { ...defaultFilters },
      '2026-11-11',
    ).courses.map((c) => c.official_url);
    expect(urls).toEqual(expected);
    expect(() =>
      withDetails({ ...catalog.editions[0]!, id: '0009999' }, chunks),
    ).toThrow('details missing');
  });

  it('hold only their own city’s editions and sources', () => {
    const elsewhere = {
      ...snapshot,
      editions: [
        ...snapshot.editions,
        edition({ id: 'zgz', city_id: 'zaragoza', institution_id: 'cc-zgz' }),
      ],
    };
    const source = (cityId: string) => ({
      institutionId: `cc-${cityId}`,
      institutionName: cityId,
      country: 'ES',
      cityId,
      listingUrl: `https://example.org/${cityId}`,
    });
    const sources = [source('barcelona'), source('zaragoza')];
    const barcelona = buildSearchIndexes(
      elsewhere,
      sources,
      '2026-11-11',
      'barcelona',
    );
    const zaragoza = buildSearchIndexes(
      elsewhere,
      sources,
      '2026-11-11',
      'zaragoza',
    );
    expect(barcelona.live.editions).toHaveLength(2);
    expect(barcelona.live.sources.map((s) => s.cityId)).toEqual(['barcelona']);
    expect(decodeIndexes([zaragoza.live]).editions).toMatchObject([
      { city_id: 'zaragoza', institution_id: 'cc-zgz' },
    ]);
  });
  it('treat an unknown end date as not ended and use the catalogue date', () => {
    expect(liveUntil({ end_date: null })).toBe('9999-12-31');
    expect(catalogToday(snapshot, new Date('2026-11-11T23:30:00Z'))).toBe(
      '2026-11-12',
    );
  });
});

describe('snapshot validation', () => {
  it('rejects source links that are not web URLs', () => {
    const bad = {
      ...snapshot,
      editions: [edition({ official_url: 'javascript:alert(1)' })],
    };
    expect(() => snapshotSchema.parse(bad)).toThrow();
    expect(snapshotSchema.parse(snapshot)).toEqual(snapshot);
  });
});

describe('course card markup', () => {
  it('escapes every source value', () => {
    const html = courseCardHtml(
      edition({
        title: '<img src=x onerror=alert(1)>',
        title_reviewed: 1,
        schedule_text: '"><script>alert(1)</script>',
        official_url: 'https://example.org/?a=1&b="x"',
      }),
      'es',
    );
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain(
      'href="https://example.org/?a=1&amp;b=&quot;x&quot;"',
    );
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });
  it('keeps the active filters on the category link and marks liveness', () => {
    const html = courseCardHtml(
      canonicalListing(edition({})),
      'ca',
      new URLSearchParams('q=test&page=3'),
    );
    expect(html).toContain(
      'href="/ca/barcelona/cursos?q=test&amp;category=idiomes"',
    );
    expect(html).toContain('data-live-until="2099-02-01"');
    expect(html).toContain('data-topic="idiomes"');
    expect(html).toContain('href="/ca/barcelona/centres/test"');
  });
  it('shows the city as a badge only when given one', () => {
    const params = new URLSearchParams();
    const withCity = courseCardHtml(edition({}), 'es', params, 'Barcelona');
    expect(withCity).toContain(
      '<a class="course-city" href="/es/barcelona/cursos">Barcelona</a></div>',
    );
    expect(withCity).toMatch(
      /<div class="course-badges"><a class="course-category"[^>]*>IDIOMES<\/a><a class="course-city"/,
    );
    const withoutCity = courseCardHtml(edition({}), 'es', params);
    expect(withoutCity).not.toContain('course-city');
    expect(withoutCity).toContain(
      '<div class="course-badges"><a class="course-category"',
    );
    expect(
      courseCardHtml(edition({ category: null }), 'es', params),
    ).not.toContain('course-badges');
  });
  it('leaves "altres" and raw categories on the neutral card', () => {
    for (const category of ['altres', 'IDIOMES', null])
      expect(courseCardHtml(edition({ category }), 'es')).not.toContain(
        'data-topic',
      );
  });
  it('names the organiser to ask when the price is unknown', () => {
    const card = (organizer: string | null) =>
      courseCardHtml(edition({ price_cents: null, organizer }), 'es');
    expect(card('Asociación <AGUA>')).toContain(
      'Precio: consultar con Asociación &lt;AGUA&gt;',
    );
    expect(card(null)).toContain('Precio por confirmar');
  });
});

describe('results view', () => {
  it('renders applied filters, pagination links and the honest empty state', () => {
    // The page's city scopes the search; it is not part of the URL query.
    const params = new URLSearchParams('q=zzz');
    const data = discover(
      snapshot,
      new URLSearchParams('q=zzz&city=barcelona'),
      '2026-11-11',
    );
    const html = discoveryResultsHtml({
      locale: 'es',
      data,
      params,
      sources: [
        {
          institutionId: 'cc-test',
          institutionName: 'TEST centre',
          country: 'ES',
          cityId: 'barcelona',
          listingUrl: 'https://example.org/listing',
        },
      ],
      alerts: true,
    });
    expect(html).toContain('Buscar por título: zzz');
    expect(html).toContain('href="/es/barcelona/cursos"');
    expect(html).not.toContain('Ciudad:');
    expect(html).toContain('class="empty"');
    expect(html).toContain('https://example.org/listing');
    expect(html).toContain('href="/es/alertas?city=barcelona"');
  });
  it('reports invalid filters without results or alert links', () => {
    const params = new URLSearchParams('page=-1');
    const html = discoveryResultsHtml({
      locale: 'es',
      data: discover(snapshot, params, '2026-11-11'),
      params,
      sources: [],
      alerts: true,
    });
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('class="course"');
    expect(html).not.toContain('/es/alertas');
  });
});

describe('category pages', () => {
  it('use topic ids as slugs, per city, in topic order', () => {
    const pages = categoryPagesFrom(snapshot, '2026-11-11');
    expect(
      pages.map((page) => [page.city, page.slug, page.courses.length]),
    ).toEqual([
      ['barcelona', 'fotografia-i-audiovisual', 1],
      ['barcelona', 'idiomes', 1],
    ]);
  });
});
