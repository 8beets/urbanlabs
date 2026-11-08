import { expect, test } from '@playwright/test';

test('localized public pages are revalidated by browsers and shareable by the CDN', async ({
  request,
}) => {
  for (const path of [
    '/es/',
    '/ca/',
    '/es/?q=TEST&category=IDIOMES',
    '/es/buscar?q=TEST&category=IDIOMES',
    '/ca/cerca?centre=cc-sant-andreu',
    '/es/centros',
    '/ca/centres',
    '/es/centros/sant-andreu',
    '/ca/centres/sant-andreu',
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toBe(
      'public, max-age=0, must-revalidate',
    );
  }
});

test('errors and private requests do not permit shared caching', async ({
  request,
}) => {
  for (const path of [
    '/es/?page=-1',
    '/ca/?maxPrice=invalid',
    '/es/centros/missing',
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.headers()['cache-control']).toBe('no-store');
  }
  for (const [name, value] of [
    ['Cookie', 'session=test'],
    ['Authorization', 'Bearer test'],
    ['Cache-Control', 'no-store'],
  ]) {
    const response = await request.get('/es/', {
      headers: { [name!]: value! },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toBe('no-store');
  }
});
