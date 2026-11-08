import { expect, test } from '@playwright/test';
import { sources } from '../../src/lib/sources';

// Every registry centre has verified coordinates, plus the isolated test centre without a
// location that appears in the list but not on the map.

// Saved transparent PNG: routine map checks never fetch third-party tiles.
const tile = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN0kAAAAASUVORK5CYII=',
  'base64',
);
test.beforeEach(async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: tile }),
  );
  await page.route('https://www.openstreetmap.org/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Offline map fixture</title>',
    }),
  );
});
for (const locale of ['es', 'ca']) {
  const base = locale === 'es' ? '/es/centros' : '/ca/centres';
  test(`${locale}: directory shows all verified markers and keyboard-accessible centre links`, async ({
    page,
  }) => {
    await page.goto(base);
    const map = page.locator('[data-centre-map]');
    await expect(map).toHaveAttribute('data-map-ready', 'true');
    await expect(page.locator('.centre-map-marker')).toHaveCount(
      sources.length,
    );
    await expect(page.locator('.centre-directory article')).toHaveCount(
      sources.length + 1,
    );
    const points = JSON.parse((await map.getAttribute('data-centres'))!);
    expect(
      points.some((p: { id: string }) => p.id === 'test-no-location'),
    ).toBe(false);
    const marker = page.getByRole('button', {
      name: 'Centre Cívic Sant Andreu',
      exact: true,
    });
    await marker.focus();
    await page.keyboard.press('Enter');
    const link = page.locator('.leaflet-popup-content a');
    await expect(link).toHaveAttribute('href', `${base}/sant-andreu`);
    await expect(link).toBeFocused();
    await expect(
      map.getByRole('link', {
        name:
          locale === 'es'
            ? 'Colaboradores de OpenStreetMap'
            : 'Col·laboradors d’OpenStreetMap',
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await link.click();
    await expect(page).toHaveURL(`${base}/sant-andreu`);
  });
}

test('tile failures keep verified markers and the full directory available', async ({
  page,
}) => {
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.abort(),
  );
  await page.goto('/es/centros');
  await expect(page.locator('[data-centre-map]')).toHaveAttribute(
    'data-map-ready',
    'true',
  );
  await expect(page.locator('[data-map-status]')).toContainText(
    'No se ha podido cargar el fondo',
  );
  await expect(page.locator('.centre-map-marker')).toHaveCount(sources.length);
  await expect(page.locator('.centre-directory article')).toHaveCount(
    sources.length + 1,
  );
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the directory remains usable without initializing a map', async ({
    page,
  }) => {
    let tileRequests = 0;
    page.on('request', (request) => {
      if (request.url().includes('tile.openstreetmap.org')) tileRequests++;
    });
    await page.goto('/es/centros');
    await expect(page.locator('[data-map-canvas]')).toBeHidden();
    await expect(page.locator('.centre-directory article')).toHaveCount(
      sources.length + 1,
    );
    expect(tileRequests).toBe(0);
    await page
      .locator('.centre-directory a[href="/es/centros/sant-andreu"]')
      .click();
    await expect(page).toHaveURL('/es/centros/sant-andreu');
  });
});
