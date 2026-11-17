import { describe, expect, it } from 'vitest';
import {
  absoluteUrl,
  centreData,
  jsonLd,
  pageLinks,
  SITE,
  websiteData,
} from '../../src/lib/seo';
import { aboutPath, localizedPaths, topicPath } from '../../src/i18n/paths';

describe('page links', () => {
  it('uses the page’s own path in its language as canonical, without the query', () => {
    expect(
      pageLinks('ca', {
        es: '/es/barcelona/cursos?category=idiomes',
        ca: '/ca/barcelona/cursos?category=idiomes',
      }).canonical,
    ).toBe(`${SITE}/ca/barcelona/cursos`);
    expect(absoluteUrl('/es/?q=x#top')).toBe(`${SITE}/es/`);
  });

  it('pairs translated slugs in hreflang, with Spanish as x-default', () => {
    expect(pageLinks('es', localizedPaths(aboutPath)).alternates).toEqual([
      { hreflang: 'es', href: `${SITE}/es/proyecto` },
      { hreflang: 'ca', href: `${SITE}/ca/projecte` },
      { hreflang: 'x-default', href: `${SITE}/es/proyecto` },
    ]);
  });

  it('keeps numbered pages as their own canonical', () => {
    const paths = localizedPaths(
      (l) => `${topicPath(l, 'barcelona', 'idiomes')}/2`,
    );
    expect(pageLinks('es', paths).canonical).toBe(
      `${SITE}${topicPath('es', 'barcelona', 'idiomes')}/2`,
    );
  });
});

describe('structured data', () => {
  it('escapes < so text cannot close the script element', () => {
    expect(jsonLd({ name: '</script><b>' })).toBe(
      '{"name":"\\u003c/script>\\u003cb>"}',
    );
  });

  it('describes the site on the home page', () => {
    expect(websiteData('ca', `${SITE}/ca/`, 'Cursos')).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'UrbanLabs',
      url: `${SITE}/ca/`,
      inLanguage: 'ca',
      description: 'Cursos',
    });
  });

  it('describes a centre only with the facts it has', () => {
    const centre = {
      name: 'Centre Cívic Exemple',
      address: 'Carrer de Prova, 1',
      city: 'Barcelona',
      country: 'ES',
      official_url: 'https://example.org/centre',
      phone: null,
      email: null,
      latitude: null,
      longitude: null,
    };
    const page = `${SITE}/ca/barcelona/centres/exemple`;
    const data = centreData(centre, page);
    expect(data).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Place',
      name: 'Centre Cívic Exemple',
      url: page,
      sameAs: 'https://example.org/centre',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Carrer de Prova, 1',
        addressLocality: 'Barcelona',
        addressCountry: 'ES',
      },
    });
    expect(
      centreData(
        { ...centre, phone: '931 234 567', latitude: 41.38, longitude: 2.17 },
        page,
      ),
    ).toMatchObject({
      telephone: '931 234 567',
      geo: { '@type': 'GeoCoordinates', latitude: 41.38, longitude: 2.17 },
    });
  });
});
