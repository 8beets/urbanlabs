import { expect, test } from '@playwright/test';

// Courses and centres live under their city (docs/adr/0010-city-sections.md).

test('the course and centre menus list the cities and work without JavaScript', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/es/');
  const courses = page.locator('.nav-menu').filter({ hasText: 'Cursos' });
  await courses.locator('summary').click();
  await expect(courses.getByRole('link')).toHaveText([
    'Barcelona',
    'El Prat de Llobregat',
    'Girona',
    'Málaga',
    'Zaragoza',
    'Todas las ciudades',
  ]);
  // Opening one menu closes the other (exclusive details, no JavaScript).
  const centresEs = page.locator('.nav-menu').filter({ hasText: 'Centros' });
  await centresEs.locator('summary').click();
  await expect(courses).not.toHaveAttribute('open');
  await courses.locator('summary').click();
  await expect(centresEs).not.toHaveAttribute('open');
  await courses.getByRole('link', { name: 'Zaragoza' }).click();
  await expect(page).toHaveURL(/\/es\/zaragoza\/cursos$/);
  await page.goto('/ca/');
  const centres = page.locator('.nav-menu').filter({ hasText: 'Centres' });
  await centres.locator('summary').focus();
  await page.keyboard.press('Enter');
  await centres.getByRole('link', { name: 'Saragossa' }).click();
  await expect(page).toHaveURL(/\/ca\/zaragoza\/centres$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Centres de Saragossa',
  );
});

test('city lists, city pages and topic pages link into each city', async ({
  page,
}) => {
  await page.goto('/es/cursos');
  await expect(page.locator('.city-list a')).toHaveCount(5);
  await page.locator('.city-list a', { hasText: 'Zaragoza' }).click();
  await expect(page).toHaveURL(/\/es\/zaragoza\/cursos$/);
  await page.goto('/es/zaragoza');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Zaragoza');
  await page.locator('.category-list a', { hasText: 'Danza' }).click();
  await expect(page).toHaveURL(/\/es\/zaragoza\/cursos\/dansa$/);
  for (const name of await page
    .locator('article.course .institution')
    .allTextContents())
    expect(name).toMatch(/^Centro Cívico /);
  await page.getByRole('link', { name: 'Català', exact: true }).click();
  await expect(page).toHaveURL(/\/ca\/zaragoza\/cursos\/dansa$/);
  await page.goto('/ca/centres');
  await page.locator('.city-list a', { hasText: 'Barcelona' }).click();
  await expect(page).toHaveURL(/\/ca\/barcelona\/centres$/);
  await expect(page.locator('#centre-list article')).not.toHaveCount(0);
  for (const name of await page.locator('#centre-list h2').allTextContents())
    expect(name).not.toMatch(/^Centro Cívico /);
});

test('cities without courses get no pages', async ({ request }) => {
  for (const path of [
    '/es/alicante',
    '/es/alicante/cursos',
    '/ca/tarragona/centres',
  ])
    expect((await request.get(path)).status(), path).toBe(404);
});
