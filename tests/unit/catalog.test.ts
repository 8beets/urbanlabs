import { describe, expect, it } from 'vitest';
import { courseCardHtml } from '../../src/lib/courses/card';
import { escapeHtml } from '../../src/lib/html';
import { discover } from '../../src/lib/catalog/discovery';
import { discoveryResultsHtml } from '../../src/lib/catalog/discovery-view';
import { categoryPagesFrom } from '../../src/lib/catalog/pages';
import {
  canonicalListing,
  catalogToday,
  liveUntil,
} from '../../src/lib/catalog/query';
import {
  buildSearchIndexes,
  decodeIndexes,
  searchIndexSchema,
} from '../../src/lib/catalog/search-index';
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
    const { live, archive } = buildSearchIndexes(snapshot, [], '2026-11-11');
    expect(searchIndexSchema.parse(live)).toEqual(live);
    const titles = (index: typeof live) =>
      decodeIndexes([index]).editions.map((e) => e.id);
    // Ids become positions in id order ('ended' < 'live' < 'open-ended').
    expect(titles(live)).toEqual(['0000001', '0000002']);
    expect(titles(archive)).toEqual(['0000000']);
    const decoded = decodeIndexes([live, archive]).editions;
    expect(decoded).toHaveLength(3);
    // Everything a card or filter needs survives; provenance ordering stays behind.
    const dropped = [
      'id',
      'last_successfully_verified_at',
      'first_seen_at',
      'source_id',
      'external_id',
    ];
    expect(decoded[0]).toMatchObject({
      ...Object.fromEntries(
        Object.entries(snapshot.editions[0]!).filter(
          ([key]) => !dropped.includes(key),
        ),
      ),
      last_successfully_verified_at: '2026-11-10',
    });
    expect(decoded[0]).not.toHaveProperty('first_seen_at');
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
    expect(html).toContain('href="/ca/cerca?q=test&amp;category=idiomes"');
    expect(html).toContain('data-live-until="2099-02-01"');
    expect(html).toContain('href="/ca/centres/test"');
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
    const params = new URLSearchParams('q=zzz&city=barcelona');
    const data = discover(snapshot, params, '2026-11-11');
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
    expect(html).toContain('href="/es/buscar?city=barcelona"');
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
  it('use topic ids as slugs, in topic order', () => {
    const pages = categoryPagesFrom(snapshot, '2026-11-11');
    expect(pages.map((page) => [page.slug, page.courses.length])).toEqual([
      ['fotografia-i-audiovisual', 1],
      ['idiomes', 1],
    ]);
  });
});
