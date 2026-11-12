import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });
test(
  'page layouts fill desktop widths while retaining gutters and mobile bounds',
  { tag: '@mobile' },
  async ({ page }) => {
    for (const locale of ['es', 'ca']) {
      for (const path of [
        `/${locale}/`,
        locale === 'es' ? '/es/barcelona/cursos' : '/ca/barcelona/cursos',
        locale === 'es' ? '/es/centros' : '/ca/centres',
        locale === 'es' ? '/es/barcelona/centros' : '/ca/barcelona/centres',
        `${locale === 'es' ? '/es/barcelona/centros' : '/ca/barcelona/centres'}/sant-andreu`,
      ]) {
        await page.goto(path);
        for (const width of [1440, 1920, 2560, 390, 320]) {
          await page.setViewportSize({ width, height: 1000 });
          const clientWidth = await page.evaluate(
            () => document.documentElement.clientWidth,
          );
          for (const element of [
            'header.shell',
            'main.shell',
            'footer.shell',
          ]) {
            const box = (await page.locator(element).boundingBox())!;
            expect(Math.abs(box.x - 20)).toBeLessThan(1);
            expect(Math.abs(box.width - (clientWidth - 40))).toBeLessThan(1);
          }
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          if (path === `/${locale}/`) {
            const photos = (await page.locator('.hero-photos').boundingBox())!;
            expect(photos.width).toBeLessThanOrEqual(560);
          }
          if (
            path ===
            (locale === 'es' ? '/es/barcelona/cursos' : '/ca/barcelona/cursos')
          ) {
            const sidebar = (await page
              .locator('.filter-sidebar')
              .boundingBox())!;
            const results = (await page
              .locator('.discovery-content')
              .boundingBox())!;
            if (width >= 800) {
              expect(sidebar.width).toBe(272);
              expect(sidebar.x + sidebar.width).toBeLessThan(results.x);
              expect(results.width).toBeGreaterThan(1000);
            } else {
              expect(sidebar.y + sidebar.height).toBeLessThan(results.y);
            }
          }
        }
      }
    }
  },
);
