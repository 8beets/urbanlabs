import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });

test('the footer links to the project page, which lists sources per city', async ({
  page,
}) => {
  await page.goto('/es/');
  await page.getByRole('link', { name: 'Sobre el proyecto' }).click();
  await expect(page).toHaveURL('/es/proyecto');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Sobre el proyecto',
  );
  const sources = page.locator('.about-sources li');
  await expect(sources.filter({ hasText: 'Barcelona' })).toHaveCount(1);
  // Cities whose licence asks for it carry the attribution and terms link.
  const zaragoza = sources.filter({ hasText: 'Zaragoza' });
  await expect(zaragoza).toContainText('Ayuntamiento de Zaragoza');
  await expect(
    zaragoza.getByRole('link', { name: 'condiciones de reutilización' }),
  ).toHaveAttribute('href', /zaragoza\.es/);
  await zaragoza.getByRole('link', { name: /Zaragoza · \d+ centros/ }).click();
  await expect(page).toHaveURL('/es/zaragoza/centros');
});

test('the project page has a Catalan version', async ({ page }) => {
  await page.goto('/es/proyecto');
  await page.getByRole('link', { name: 'Català' }).click();
  await expect(page).toHaveURL('/ca/projecte');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Sobre el projecte',
  );
  await expect(page.locator('.about-sources')).toContainText(
    'Ajuntament de Saragossa',
  );
});
