import { expect, test } from '@playwright/test';

test.describe('cancelled course discovery', () => {
  for (const locale of ['es', 'ca'] as const) {
    const search =
      locale === 'es' ? '/es/barcelona/cursos' : '/ca/barcelona/cursos';
    const label = locale === 'es' ? 'Cancelado' : 'Cancel·lat';
    test(`${locale}: cancellation labels, prices, ordering and filters`, async ({
      page,
    }) => {
      await page.goto(`${search}?centre=cc-pati-llimona`);
      await expect(page.locator('.course')).toHaveCount(5);
      await expect(
        page.locator('.course').nth(2).locator('.cancelled-label'),
      ).toHaveCount(0);
      const cancelled = page
        .locator('.course')
        .filter({ has: page.locator('.cancelled-label') });
      await expect(cancelled).toHaveCount(2);
      await expect(cancelled.locator('.cancelled-label')).toHaveText([
        label,
        label,
      ]);
      await expect(cancelled.locator('.price')).toHaveCount(0);
      await expect(cancelled.locator('.source-link')).toHaveCount(2);
      if (page.viewportSize()!.width < 800)
        await page.locator('#filter-panel summary').click();
      await page.locator('#cancellation').check();
      await page.locator('button[type="submit"]').click();
      expect(new URL(page.url()).searchParams.get('cancellation')).toBe('hide');
      await expect(page.locator('.course')).toHaveCount(3);
      await expect(page.locator('.cancelled-label')).toHaveCount(0);
      // "Only cancelled" has no control but stays a valid shareable URL.
      await page.goto(`${search}?centre=cc-pati-llimona&cancellation=only`);
      await expect(page.locator('.course')).toHaveCount(2);
      await expect(page.locator('#cancellation')).not.toBeChecked();
      await page
        .getByRole('link', {
          name: locale === 'es' ? 'Català' : 'Español',
          exact: true,
        })
        .click();
      expect(new URL(page.url()).searchParams.get('cancellation')).toBe('only');
      await expect(page.locator('.cancelled-label')).toHaveText(
        locale === 'es'
          ? ['Cancel·lat', 'Cancel·lat']
          : ['Cancelado', 'Cancelado'],
      );
      await page.goto(`${search}?cancellation=hide`);
      await expect(page.locator('.cancelled-label')).toHaveCount(0);
      await expect(
        page.locator('#centre option[value="fab-casa-del-mig"]'),
      ).toHaveCount(0);
      await page.goto(`${search}?centre=fab-casa-del-mig&cancellation=only`);
      await expect(page.locator('.cancelled-label')).toHaveText(label);
      await expect(page.locator('.price')).toContainText(/41,20/);
      await page.goto(`${search}?centre=cc-el-sortidor`);
      await expect(page.locator('.cancelled-label')).toHaveCount(0);
      await expect(page.locator('.price')).toHaveText(
        locale === 'ca' ? 'Gratuït' : 'Gratis',
      );
      await page.goto(`/${locale}/`);
      await expect(page.locator('.latest-courses .course')).toHaveCount(20);
      await expect(page.locator('.cancelled-label')).toHaveCount(0);
      await page.goto(`${search}?cancellation=invalid`);
      await expect(page.getByRole('alert')).toBeVisible();
    });
  }
});

test('changing cancellation updates dependent options before explicit submission', async ({
  page,
}) => {
  await page.goto('/es/barcelona/cursos');
  if (page.viewportSize()!.width < 800)
    await page.locator('#filter-panel summary').click();
  await expect(
    page.locator('#centre option[value="fab-casa-del-mig"]'),
  ).toHaveCount(1);
  await page.locator('#cancellation').check();
  await expect(
    page.locator('#centre option[value="fab-casa-del-mig"]'),
  ).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has('cancellation')).toBe(false);
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('#cancellation')).toBeChecked();
  await expect(page.locator('.cancelled-label')).toHaveCount(0);
  const chip = page.getByRole('link', {
    name: 'Quitar filtro: Ocultar cancelados',
    exact: true,
  });
  await chip.click();
  expect(new URL(page.url()).searchParams.has('cancellation')).toBe(false);
  await expect(page.locator('#cancellation')).not.toBeChecked();
});
