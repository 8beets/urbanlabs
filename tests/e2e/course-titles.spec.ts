import { expect, test } from '@playwright/test';

// Search cards are rendered by the browser; centre cards are prerendered.
for (const locale of ['es', 'ca']) {
  test(`${locale}: all-caps source titles are readable on search and centre cards`, async ({
    page,
  }) => {
    for (const path of [
      `${locale === 'es' ? '/es/barcelona/cursos' : '/ca/barcelona/cursos'}?centre=cc-sant-andreu&q=TERTÚLIA`,
      `${locale === 'es' ? '/es/barcelona/centros' : '/ca/barcelona/centres'}/sant-andreu`,
    ]) {
      await page.goto(path);
      const title = page.getByRole('heading', {
        name: 'Tertúlia literària en anglès',
        exact: true,
      });
      if (path.includes('/sant-andreu') && (await title.count()) === 0) {
        await page.locator('a[rel="next"]').click();
      }
      await expect(title).toBeVisible();
      await expect(title).toHaveAttribute(
        'title',
        'TERTÚLIA LITERÀRIA EN ANGLÈS',
      );
      expect(
        await title.evaluate(
          (element) => getComputedStyle(element).textTransform,
        ),
      ).toBe('none');
    }
    await page.goto(
      `${locale === 'es' ? '/es/barcelona/cursos' : '/ca/barcelona/cursos'}?q=TEST+REVIEWED`,
    );
    await expect(
      page.getByRole('heading', {
        name: 'TEST REVIEWED COURSE: JOAN',
        exact: true,
      }),
    ).toBeVisible();
    await page.goto(
      `${locale === 'es' ? '/es/barcelona/cursos' : '/ca/barcelona/cursos'}?centre=fab-casa-del-mig`,
    );
    await expect(
      page.getByRole('heading', {
        name: 'Control de LEDs amb TouchDesigner',
        exact: true,
      }),
    ).toBeVisible();
    await page.goto(
      `${locale === 'es' ? '/es/barcelona/cursos' : '/ca/barcelona/cursos'}?centre=cc-golferichs&category=cuina`,
    );
    await expect(
      page.getByRole('heading', {
        name: 'Cuina i maridatge. Sorprèn a la colla',
        exact: true,
      }),
    ).toBeVisible();
  });
}
