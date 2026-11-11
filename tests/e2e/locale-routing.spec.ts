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

test('legacy Spanish URLs redirect permanently to their prefixed paths', async ({
  request,
  page,
}) => {
  for (const [oldPath, newPath] of [
    ['/', '/es/'],
    ['/centros', '/es/centros'],
    ['/centros/sant-andreu', '/es/centros/sant-andreu'],
  ] as const) {
    const response = await request.get(oldPath, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(new URL(response.headers().location!, 'http://x').pathname).toBe(
      newPath,
    );
  }
  await page.goto('/centros/sant-andreu');
  await expect(page).toHaveURL('/es/centros/sant-andreu');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
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
      `/${locale}/${centres}/sant-andreu/2`,
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

test('unsupported locale routes return 404 and the search index is available', async ({
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
  const response = await request.get('/search/live.json');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/json');
  expect((await response.json()).editions.length).toBeGreaterThan(0);
});

test('prerendered pages carry their own language and set no cookies', async ({
  request,
}) => {
  await Promise.all(
    ['es', 'ca'].map(async (locale) => {
      const search = locale === 'es' ? 'buscar' : 'cerca';
      const response = await request.get(`/${locale}/${search}`);
      expect(response.status()).toBe(200);
      expect(response.headers()['set-cookie']).toBeUndefined();
      const html = await response.text();
      expect(html).toContain(`lang="${locale}"`);
      expect(html).toContain(
        locale === 'es' ? 'Todas las categorías' : 'Totes les categories',
      );
    }),
  );
});
