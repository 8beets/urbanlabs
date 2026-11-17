import { expect, test, type Page } from '@playwright/test';

const SITE = 'https://urbanlabs.fyi';

const head = (page: Page) => ({
  robots: page.locator('meta[name="robots"]'),
  canonical: page.locator('link[rel="canonical"]'),
  alternate: (lang: string) =>
    page.locator(`link[rel="alternate"][hreflang="${lang}"]`),
  jsonLd: async () =>
    JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent())!,
    ) as Record<string, unknown>,
});

test('pages are indexable, with canonical, hreflang and Open Graph links', async ({
  page,
}) => {
  await page.goto('/es/');
  const tags = head(page);
  await expect(tags.robots).toHaveCount(0);
  await expect(tags.canonical).toHaveAttribute('href', `${SITE}/es/`);
  await expect(tags.alternate('ca')).toHaveAttribute('href', `${SITE}/ca/`);
  await expect(tags.alternate('x-default')).toHaveAttribute(
    'href',
    `${SITE}/es/`,
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    'content',
    `${SITE}/es/`,
  );
  expect(await tags.jsonLd()).toMatchObject({
    '@type': 'WebSite',
    url: `${SITE}/es/`,
    inLanguage: 'es',
  });

  // Translated slugs are paired, and filters in the query share one canonical.
  await page.goto('/ca/projecte');
  await expect(tags.alternate('es')).toHaveAttribute(
    'href',
    `${SITE}/es/proyecto`,
  );
  await page.goto('/es/barcelona/cursos?category=idiomes');
  await expect(tags.canonical).toHaveAttribute(
    'href',
    `${SITE}/es/barcelona/cursos`,
  );
});

test('titles and descriptions differ between related pages', async ({
  page,
}) => {
  const seen = new Map<string, string>();
  for (const path of [
    '/es/barcelona',
    '/es/barcelona/cursos',
    '/es/barcelona/centros',
  ]) {
    await page.goto(path);
    const title = await page.title();
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute('content');
    for (const value of [title, description!]) {
      expect(seen.get(value), `${path} repeats ${seen.get(value)}`).toBe(
        undefined,
      );
      seen.set(value, path);
    }
  }
});

test('centre pages describe the centre in structured data', async ({
  page,
}) => {
  await page.goto('/es/barcelona/centros');
  const link = page.locator('#centre-list h2 a').first();
  const name = (await link.textContent())!.trim();
  await link.click();
  expect(await head(page).jsonLd()).toMatchObject({
    '@type': 'Place',
    name,
    url: `${SITE}${new URL(page.url()).pathname}`,
    address: { '@type': 'PostalAddress', addressLocality: 'Barcelona' },
  });
});

test('alert pages stay out of search results', async ({ page }) => {
  await page.goto('/es/alertas');
  const tags = head(page);
  await expect(tags.robots).toHaveAttribute('content', 'noindex,follow');
  await expect(tags.canonical).toHaveCount(0);
});

test('robots.txt points to a sitemap of the indexable pages', async ({
  request,
}) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain(`Sitemap: ${SITE}/sitemap-index.xml`);
  expect(robots).not.toMatch(/^Disallow: \/$/m);
  const index = await (await request.get('/sitemap-index.xml')).text();
  const sitemap = index.match(/<loc>[^<]*\/(sitemap-\d+\.xml)<\/loc>/)![1]!;
  const urls = await (await request.get(`/${sitemap}`)).text();
  for (const path of ['/es/', '/ca/', '/es/barcelona/cursos', '/ca/projecte'])
    expect(urls).toContain(`<loc>${SITE}${path}</loc>`);
  expect(urls).not.toMatch(/alertas|alertes|\/search\/|\/404/);
});
