import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });

for (const { path, locale, heading, search, centres } of [
  {
    path: '/missing-page',
    locale: 'es',
    heading: 'Página no encontrada',
    search: '/es/buscar',
    centres: '/es/centros',
  },
  {
    path: '/es/missing/nested-page',
    locale: 'es',
    heading: 'Página no encontrada',
    search: '/es/buscar',
    centres: '/es/centros',
  },
  {
    path: '/ca/missing/nested-page',
    locale: 'ca',
    heading: 'Pàgina no trobada',
    search: '/ca/cerca',
    centres: '/ca/centres',
  },
]) {
  test(`missing URL ${path} offers localized recovery links`, async ({
    page,
  }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page).toHaveTitle(`404 · ${heading} · UrbanLabs`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    await expect(page.locator('.primary-nav [aria-current]')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex,follow',
    );

    for (const href of [`/${locale}/`, search, centres]) {
      const link = page.locator(`main a[href="${href}"]`);
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(href);
      await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(
        heading,
      );
      await page.goto(path);
    }

    const otherLocale = locale === 'es' ? 'ca' : 'es';
    await page.locator(`.language-nav a[lang="${otherLocale}"]`).click();
    await expect(page.locator('html')).toHaveAttribute('lang', otherLocale);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      otherLocale === 'es' ? 'Página no encontrada' : 'Pàgina no trobada',
    );
  });
}
