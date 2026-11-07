import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });
test.beforeEach(async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.abort(),
  );
  await page.route('https://www.openstreetmap.org/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Offline map fixture</title>',
    }),
  );
});

test('legacy Spanish URLs redirect permanently and retain query parameters', async ({
  request,
  page,
}) => {
  const query =
    '?category=IDIOMES&centre=cc-sant-andreu&page=2&q=TEST%20workshop';
  for (const [oldPath, newPath] of [
    ['/', '/es/'],
    ['/centros', '/es/centros'],
    ['/centros/sant-andreu', '/es/centros/sant-andreu'],
  ]) {
    const response = await request.get(oldPath + query, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(newPath + query);
  }
  await page.goto('/?centre=cc-sant-andreu#discovery');
  await expect(page).toHaveURL('/es/buscar?centre=cc-sant-andreu#discovery');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.locator('#centre')).toHaveValue('cc-sant-andreu');
});

test('all page links and search forms use explicit locale prefixes', async ({
  page,
}) => {
  for (const locale of ['es', 'ca']) {
    const centres = locale === 'es' ? 'centros' : 'centres';
    for (const path of [
      `/${locale}/`,
      `${locale === 'es' ? '/es/buscar' : '/ca/cerca'}?centre=cc-sant-andreu`,
      `/${locale}/${centres}`,
      `/${locale}/${centres}/sant-andreu?page=2`,
    ]) {
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      const navigation = await page
        .locator('a[href], form[action]')
        .evaluateAll((nodes) =>
          nodes
            .map((node) =>
              node.getAttribute(node.tagName === 'FORM' ? 'action' : 'href')!,
            )
            .filter((href) => href.startsWith('/') && !href.startsWith('//')),
        );
      expect(navigation.length).toBeGreaterThan(3);
      for (const href of navigation) expect(href).toMatch(/^\/(es|ca)(\/|$)/);
      const brand = page.locator('.brand');
      await expect(brand).toHaveAttribute('href', `/${locale}/`);
    }
  }
});

test('unsupported locale routes return 404 and shared endpoints remain available', async ({
  request,
}) => {
  for (const path of [
    '/en/',
    '/en/buscar',
    '/buscar',
    '/ca/buscar',
    '/es/cerca',
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(404);
  }
  const response = await request.get('/api/filters?locale=ca');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/json');
  expect(await response.json()).toHaveProperty('centres');
});

test('concurrent localized pages and API responses retain their own translations', async ({
  request,
}) => {
  await Promise.all(
    ['es', 'ca'].map(async (locale) => {
      const search = locale === 'es' ? 'buscar' : 'cerca';
      const response = await request.get(
        `/${locale}/${search}?maxPrice=invalid`,
      );
      expect(response.status()).toBe(400);
      expect(response.headers()['set-cookie']).toBeUndefined();
      const html = await response.text();
      expect(html).toContain(`lang="${locale}"`);
      expect(html).toContain(
        locale === 'es' ? 'Revisa los filtros:' : 'Revisa els filtres:',
      );

      const options = await request.get(`/api/filters?locale=${locale}`);
      expect(options.status()).toBe(200);
      const body = await options.json();
      expect(body.categories).toContainEqual({
        value: 'FOTOGRAFIA',
        label: locale === 'es' ? 'Fotografía' : 'Fotografia',
      });
    }),
  );
});
