import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });
for (const locale of ['es', 'ca']) {
  const search = locale === 'es' ? '/es/buscar' : '/ca/cerca';
  test(`${locale}: homepage shows only the latest 20 courses and links to separate search`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/`);
    await expect(page.locator('.latest-courses .course')).toHaveCount(20);
    await expect(
      page.locator('form[method=get],.filter-sidebar,.pagination'),
    ).toHaveCount(0);
    await expect(page.locator('.hero-link')).toHaveAttribute('href', search);
    await expect(page.locator('.primary-nav a[aria-current]')).toHaveAttribute(
      'href',
      `/${locale}/`,
    );
    const category = page.locator('.course-category').first();
    const categoryUrl = new URL(
      (await category.getAttribute('href'))!,
      'http://localhost',
    );
    expect(categoryUrl.pathname).toBe(search);
    expect(categoryUrl.searchParams.get('category')).toBeTruthy();
    await page.locator('.hero-link').click();
    await expect(page).toHaveURL(search);
    await expect(page.locator('.filter-sidebar')).toBeVisible();
    await expect(page.locator('.hero-photos,.latest-courses')).toHaveCount(0);
    await page.locator('.brand').click();
    await expect(page).toHaveURL(`/${locale}/`);
  });
  test(`${locale}: old homepage filter parameters just show the homepage`, async ({
    page,
  }) => {
    // Legacy query strings are not carried over (ADR 0008): the static homepage answers.
    const response = await page.goto(
      `/${locale}/?centre=cc-sant-andreu&category=IDIOMES&page=2`,
    );
    expect(response?.status()).toBe(200);
    await expect(page.locator('.latest-courses .course')).toHaveCount(20);
  });
}
