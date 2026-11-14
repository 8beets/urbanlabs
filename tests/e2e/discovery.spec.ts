import { expect, test } from '@playwright/test';
import { sources } from '../../src/lib/sources';
import { PAGE_SIZE } from '../../src/lib/catalog/query';

// Search runs in the browser over the static index (docs/adr/0008-static-site.md).
// Static pages (homepage, centres, category pages) keep working without JavaScript.

// Filter logic is the same at every width. On phones the panel starts collapsed (the
// 'progressive filter panel' tests cover that), so the logic tests use a wide window.
test.beforeEach(async ({ page }, testInfo) => {
  if (
    !testInfo.titlePath.includes('without JavaScript') &&
    page.viewportSize()!.width < 800
  )
    await page.setViewportSize({ width: 1280, height: 900 });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test(
    'Spanish homepage and Catalan language switching work without client JavaScript',
    { tag: '@mobile' },
    async ({ page }) => {
      await page.goto('/es/');
      await expect(
        page.getByRole('heading', { name: 'Aprende cerca de casa' }),
      ).toBeVisible();
      await expect(page.locator('.schedule').first()).toHaveText(
        /^(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo)\b/i,
      );
      await expect(page.locator('html')).toHaveAttribute('lang', 'es');
      await expect(page.locator('.hero-photos figure')).toHaveCount(4);
      await expect(page.locator('.hero-photos figcaption')).toHaveText([
        'Música',
        'Cerámica',
        'Electrónica',
        'Bricolaje',
      ]);
      await expect
        .poll(() =>
          page
            .locator('.hero-photos img')
            .evaluateAll((images) =>
              images.every(
                (image) =>
                  image instanceof HTMLImageElement &&
                  image.complete &&
                  image.naturalWidth > 0,
              ),
            ),
        )
        .toBe(true);
      await expect(page.locator('.brand img')).toHaveAttribute(
        'src',
        '/images/brand/learnaprop-logo.png',
      );
      const repository = page
        .getByRole('contentinfo')
        .getByRole('link', { name: 'Código en GitHub', exact: true });
      await expect(repository).toHaveAttribute(
        'href',
        'https://github.com/8beets/urbanlabs',
      );
      await expect(repository.locator('img')).toHaveAttribute(
        'src',
        '/icons/github.svg',
      );
      await page.getByRole('link', { name: 'Català' }).click();
      await expect(
        page.getByRole('heading', { name: 'Aprèn a prop de casa' }),
      ).toBeVisible();
      await expect(
        page
          .getByRole('contentinfo')
          .getByRole('link', { name: 'Codi a GitHub', exact: true }),
      ).toHaveAttribute('href', 'https://github.com/8beets/urbanlabs');
      await expect(page.locator('html')).toHaveAttribute('lang', 'ca');
      await expect(page.locator('.hero-photos figcaption')).toHaveText([
        'Música',
        'Ceràmica',
        'Electrònica',
        'Bricolatge',
      ]);
      await expect(page.locator('.schedule').first()).toHaveText(
        /^(Dilluns|Dimarts|Dimecres|Dijous|Divendres|Dissabte|Diumenge)\b/i,
      );
    },
  );
});

async function submit(page: import('@playwright/test').Page) {
  await page
    .getByRole('button', { name: /^(Buscar cursos|Cerca cursos)$/ })
    .click();
}

function query(page: import('@playwright/test').Page) {
  return new URL(page.url()).searchParams;
}

test('search uses shareable URL filters and an honest empty state', async ({
  page,
}) => {
  await page.goto('/es/barcelona/cursos');
  await page.getByLabel('Buscar por título').fill('no-such-course-abc123');
  await submit(page);
  expect(query(page).get('q')).toBe('no-such-course-abc123');
  await expect(
    page.getByRole('heading', {
      name: 'Todavía no hay cursos que coincidan con tu búsqueda.',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', {
      name: /Programación oficial: Centre Cívic Sant Andreu/,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('start month filter offers the next 12 months and composes through the URL', async ({
  page,
}) => {
  await page.goto('/es/barcelona/cursos');
  const options = page.locator('#start option');
  await expect(options).toHaveCount(13);
  await expect(options.first()).toHaveText('Cualquier mes');
  const month = await options.nth(1).getAttribute('value');
  expect(month).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
  await page.locator('#start').selectOption({ index: 1 });
  await submit(page);
  expect(query(page).get('start')).toBe(month);
  await expect(page.locator('#start')).toHaveValue(month!);
  // Seeded editions start on 2099-01-01; unknown or other months do not match.
  await page.goto('/es/barcelona/cursos?start=2099-01');
  expect(await page.locator('article.course').count()).toBeGreaterThan(0);
  await expect(
    page
      .getByRole('group', { name: 'Filtros aplicados', exact: true })
      .getByRole('link', { name: /Mes de inicio: Enero de 2099/ }),
  ).toBeVisible();
  await expect(page.locator('#start option[selected]')).toHaveText(
    /Enero de 2099/,
  );
  await page.goto('/es/barcelona/cursos?start=2099-02');
  await expect(page.locator('article.course')).toHaveCount(0);
  await page.goto('/ca/barcelona/cursos?start=2099-01');
  await expect(page.locator('#start')).toHaveValue('2099-01');
  await page
    .getByRole('link', { name: /^Treu el filtre/ })
    .first()
    .click();
  expect(query(page).has('start')).toBe(false);
});

test('invalid URL filters show an accessible error', async ({ page }) => {
  // A static page always answers 200; the browser search reports the error.
  await page.goto('/es/barcelona/cursos?page=-1');
  await expect(page.getByRole('alert')).toContainText('Revisa los filtros');
  await expect(page.locator('article.course')).toHaveCount(0);
  await expect(page.locator('#q')).toHaveAttribute(
    'aria-describedby',
    'filter-error',
  );
});

test('categories compose with search, pagination, and locale switching', async ({
  page,
}) => {
  await page.goto('/es/barcelona/cursos?page=2');
  const width = (await page.locator('#q').boundingBox())!.width;
  await page.getByLabel('Categoría', { exact: true }).selectOption('idiomes');
  await submit(page);
  expect(query(page).get('category')).toBe('idiomes');
  expect(query(page).has('page')).toBe(false);
  expect((await page.locator('#q').boundingBox())!.width).toBeCloseTo(width, 1);
  await page.getByRole('link', { name: /^Siguiente/ }).click();
  expect(query(page).get('page')).toBe('2');
  expect(query(page).get('category')).toBe('idiomes');
  await page.getByRole('link', { name: 'Català', exact: true }).click();
  await expect(page.getByLabel('Categoria', { exact: true })).toHaveValue(
    'idiomes',
  );
  expect(query(page).get('page')).toBe('2');
  await page.getByLabel('Cerca per títol').fill('Tertúlia literària en anglès');
  await submit(page);
  await expect(page.locator('article.course')).toHaveCount(1);
  await expect(page.locator('article.course h3')).toHaveText(
    'Tertúlia literària en anglès',
  );
  await page.getByLabel('Categoria', { exact: true }).selectOption('dansa');
  await submit(page);
  await expect(
    page.getByRole('heading', {
      name: 'Encara no hi ha cursos que coincideixin amb la teva cerca.',
    }),
  ).toBeVisible();
});

test('centre selection composes with categories, keyword, and language switching', async ({
  page,
}) => {
  await page.goto('/es/barcelona/cursos?category=idiomes&page=2');
  await page.getByLabel('Centro', { exact: true }).selectOption('cc-can-baste');
  await submit(page);
  expect(query(page).get('centre')).toBe('cc-can-baste');
  expect(query(page).get('category')).toBe('idiomes');
  expect(query(page).has('page')).toBe(false);
  await expect(page.locator('article.course')).toHaveCount(1);
  await expect(page.locator('article.course .institution')).toHaveText(
    'Centre Cívic Can Basté',
  );
  await page.getByLabel('Buscar por título').fill('TEST');
  await submit(page);
  await page.getByRole('link', { name: 'Català', exact: true }).click();
  await expect(page.getByLabel('Centre', { exact: true })).toHaveValue(
    'cc-can-baste',
  );
  await page.getByLabel('Centre', { exact: true }).selectOption('');
  await submit(page);
  expect(query(page).get('centre')).toBe('');
  expect(query(page).get('category')).toBe('idiomes');
  await expect(page.locator('article.course')).toHaveCount(PAGE_SIZE);
  await page
    .getByRole('link', { name: 'Neteja els filtres', exact: true })
    .click();
  await page
    .getByLabel('Centre', { exact: true })
    .selectOption('cc-pati-llimona');
  await submit(page);
  await page
    .getByLabel('Categoria', { exact: true })
    .selectOption('fotografia-i-audiovisual');
  await submit(page);
  // Cinema and both photography categories share one topic.
  await expect(page.locator('article.course .institution')).toHaveText(
    Array(3).fill('Centre Cívic Pati Llimona'),
  );
});

test('photography categories share one topic and topics follow the selected centre', async ({
  page,
}) => {
  await page.goto('/es/barcelona/cursos?category=IDIOMES');
  await expect(page.getByRole('alert')).toContainText('Revisa los filtros');
  await page.goto('/es/barcelona/cursos?category=fotografia-i-audiovisual');
  await expect(page.locator('#category')).toHaveValue(
    'fotografia-i-audiovisual',
  );
  await expect(
    page.locator('#category option[value="fotografia-i-audiovisual"]'),
  ).toHaveCount(1);
  await expect(page.locator('article.course .course-category')).toHaveText(
    Array(5).fill('Fotografía y audiovisual'),
  );
  await page
    .getByLabel('Centro', { exact: true })
    .selectOption('cc-pati-llimona');
  await submit(page);
  await expect(page.locator('#category option')).toHaveText([
    'Todas las categorías',
    'Fotografía y audiovisual',
    'Danza y baile',
    'Otros',
  ]);
  await expect(page.locator('article.course')).toHaveCount(3);
  await page.getByRole('link', { name: 'Català', exact: true }).click();
  await expect(page.locator('#category option')).toHaveText([
    'Totes les categories',
    'Fotografia i audiovisual',
    'Dansa i ball',
    'Altres',
  ]);
  await page.getByLabel('Centre', { exact: true }).selectOption('cc-can-baste');
  await submit(page);
  await expect(page.locator('#category option')).toHaveText([
    'Totes les categories',
    'Fotografia i audiovisual',
    'Idiomes',
  ]);
  await expect(page.locator('article.course')).toHaveCount(1);
  await page.getByLabel('Centre', { exact: true }).selectOption('');
  await submit(page);
  await expect(page.locator('#category option[value="dansa"]')).toHaveText(
    'Dansa i ball',
  );
  await expect(page.locator('article.course')).toHaveCount(5);
});

test('Golferichs filters its own normalized categories and retains official source links', async ({
  page,
}) => {
  await page.goto('/es/barcelona/cursos');
  await page
    .getByLabel('Centro', { exact: true })
    .selectOption('cc-golferichs');
  await submit(page);
  await expect(page.locator('#category option')).toHaveText([
    'Todas las categorías',
    'Fotografía y audiovisual',
    'Cocina y gastronomía',
  ]);
  await expect(page.locator('article.course')).toHaveCount(2);
  await page
    .getByLabel('Categoría', { exact: true })
    .selectOption('fotografia-i-audiovisual');
  await submit(page);
  await expect(page.locator('article.course')).toHaveCount(1);
  await expect(
    page
      .locator('article.course')
      .getByRole('link', { name: /Consultar fuente oficial/ }),
  ).toHaveAttribute(
    'href',
    /https:\/\/golferichs\.inscripcionscc\.com\/.*#accordion7350$/,
  );
  await page.getByRole('link', { name: 'Català', exact: true }).click();
  await expect(page.locator('#category option')).toHaveText([
    'Totes les categories',
    'Fotografia i audiovisual',
    'Cuina i gastronomia',
  ]);
  await expect(page.locator('article.course h3')).toHaveText(
    'Tècniques bàsiques (1r nivell): coneixement de la càmera',
  );
});

test('every added centre offers its own categories in both locales', async ({
  page,
}) => {
  for (const [id, name, es, ca] of [
    [
      'cc-casa-elizalde',
      'Centre Cultural La Casa Elizalde',
      'Humanidades y ciencia',
      'Humanitats i ciència',
    ],
    [
      'cc-albareda',
      'Centre Cultural Albareda',
      'Música y canto',
      'Música i cant',
    ],
    [
      'cc-el-sortidor',
      'Centre Cívic El Sortidor',
      'Cocina y gastronomía',
      'Cuina i gastronomia',
    ],
    [
      'cc-vil-la-urania',
      'Centre Cívic Vil·la Urània',
      'Artes plásticas y manualidades',
      'Arts plàstiques i manualitats',
    ],
    [
      'cc-urgell',
      'Centre Cívic Urgell',
      'Humanidades y ciencia',
      'Humanitats i ciència',
    ],
    [
      'fab-casa-del-rellotge',
      'FAB Casa del Rellotge',
      'Tecnología e informática',
      'Tecnologia i informàtica',
    ],
    [
      'fab-casa-del-mig',
      'FAB Casa del Mig',
      'Tecnología e informática',
      'Tecnologia i informàtica',
    ],
  ]) {
    await page.goto('/es/barcelona/cursos');
    await page.getByLabel('Centro', { exact: true }).selectOption(id!);
    await submit(page);
    await expect(page.locator('article.course')).toHaveCount(1);
    await expect(page.locator('article.course .institution')).toHaveText(name!);
    await expect(page.locator('#category option')).toHaveText([
      'Todas las categorías',
      es!,
    ]);
    await page.getByRole('link', { name: 'Català', exact: true }).click();
    await expect(page.locator('#category option')).toHaveText([
      'Totes les categories',
      ca!,
    ]);
  }
});

test('FAB centres retain separate filters and Miram activity types', async ({
  page,
}) => {
  for (const [centre, type, id] of [
    ['fab-casa-del-rellotge', 'CR', '675'],
    ['fab-casa-del-mig', 'CM', '674'],
  ]) {
    await page.goto('/es/barcelona/cursos');
    await page.getByLabel('Centro', { exact: true }).selectOption(centre!);
    await submit(page);
    const link = page
      .locator('article.course')
      .getByRole('link', { name: /Consultar fuente oficial/ });
    const url = new URL((await link.getAttribute('href'))!);
    expect(url.hostname).toBe('fabcasadelmig.miram.cloud');
    expect(url.searchParams.get('t')).toBe(type);
    expect(url.hash).toBe(`#accordion${id}`);
  }
});

test('applied filters can be removed individually or cleared, preserving other URL state', async ({
  page,
}) => {
  await page.goto(
    '/es/barcelona/cursos?q=TEST&centre=cc-can-baste&category=idiomes&maxPrice=100&page=2',
  );
  await expect(
    page
      .getByRole('group', { name: 'Filtros aplicados', exact: true })
      .getByRole('link'),
  ).toHaveCount(4);
  await page
    .getByRole('link', { name: /^Quitar filtro: Precio máximo/ })
    .click();
  expect(query(page).has('maxPrice')).toBe(false);
  expect(query(page).has('page')).toBe(false);
  expect(query(page).get('centre')).toBe('cc-can-baste');
  await expect(page.locator('article.course')).toHaveCount(1);
  await page
    .getByRole('link', { name: /^Quitar filtro: Buscar por título/ })
    .click();
  expect(query(page).has('q')).toBe(false);
  await submit(page);
  expect(query(page).get('centre')).toBe('cc-can-baste');
  await page
    .getByRole('link', { name: 'Limpiar filtros', exact: true })
    .click();
  await expect(page).toHaveURL('http://127.0.0.1:4322/es/barcelona/cursos');
  await expect(
    page.getByRole('group', { name: 'Filtros aplicados', exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('#q')).toHaveValue('');
  await expect(page.locator('#centre')).toHaveValue('');
  await expect(page.locator('#category')).toHaveValue('');
  await expect(page.locator('#maxPrice')).toHaveCount(0);
});

test('incompatible selected categories remain visible and removable', async ({
  page,
}) => {
  await page.goto(
    '/es/barcelona/cursos?centre=cc-pati-llimona&category=idiomes',
  );
  await expect(page.locator('#category')).toHaveValue('idiomes');
  await expect(page.locator('#category option:checked')).toHaveText(
    'Idiomas (Selección actual)',
  );
  await page
    .getByRole('link', {
      name: 'Quitar filtro: Categoría: Idiomas',
      exact: true,
    })
    .click();
  await expect(page.locator('#category')).toHaveValue('');
  await expect(page.locator('article.course')).toHaveCount(5);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test(
    'native filters are keyboard-collapsible without JavaScript and sit beside desktop results',
    { tag: '@mobile' },
    async ({ page }) => {
      await page.goto('/es/barcelona/cursos');
      const panel = page.locator('#filter-panel');
      const sidebar = (await page.locator('.filter-sidebar').boundingBox())!;
      const results = (await page.locator('.discovery-content').boundingBox())!;
      if (page.viewportSize()!.width >= 800) {
        expect(sidebar.x + sidebar.width).toBeLessThan(results.x);
        expect(Math.abs(sidebar.y - results.y)).toBeLessThan(3);
      } else {
        expect(sidebar.y + sidebar.height).toBeLessThan(results.y);
      }
      const summary = panel.locator('summary');
      await summary.focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#q')).toBeHidden();
      await page.keyboard.press('Enter');
      await expect(page.locator('#q')).toBeVisible();
      await page.keyboard.press('Tab');
      await expect(page.locator('#q')).toBeFocused();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    },
  );
  test(
    'search explains it needs JavaScript and links to static browsing',
    { tag: '@mobile' },
    async ({ page }) => {
      await page.goto('/es/barcelona/cursos?q=anything');
      await expect(page.locator('.search-noscript')).toContainText(
        'necesita JavaScript',
      );
      await page.getByRole('link', { name: 'Explorar por categoría' }).click();
      await expect(page).toHaveURL('/es/barcelona/');
      await page.getByRole('link', { name: /^Idiomas \(\d+\)$/ }).click();
      await expect(page).toHaveURL('/es/barcelona/cursos/idiomes');
      await expect(page.locator('article.course')).toHaveCount(PAGE_SIZE);
      await page.locator('a[rel="next"]').click();
      await expect(page).toHaveURL('/es/barcelona/cursos/idiomes/2');
      await page.getByRole('link', { name: 'Català' }).click();
      await expect(page).toHaveURL('/ca/barcelona/cursos/idiomes/2');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Idiomes · Barcelona',
      );
    },
  );
});

test.describe('progressive filter panel', { tag: '@mobile' }, () => {
  test.use({ javaScriptEnabled: true });
  test('mobile starts collapsed, works by keyboard, and reopens on desktop resize', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/es/barcelona/cursos');
    const panel = page.locator('#filter-panel');
    await expect(panel).not.toHaveAttribute('open');
    await panel.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#q')).toBeVisible();
    await page.locator('#q').fill('TEST');
    await submit(page);
    await expect(panel).not.toHaveAttribute('open');
    await expect(
      page.getByRole('group', { name: 'Filtros aplicados', exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(panel).toHaveAttribute('open', '');
    await expect(page.locator('#q')).toHaveValue('TEST');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(panel).not.toHaveAttribute('open');
    await page
      .getByRole('link', { name: 'Limpiar filtros', exact: true })
      .click();
    await expect(
      page.getByRole('group', { name: 'Filtros aplicados', exact: true }),
    ).toHaveCount(0);
  });
  test('mobile validation errors leave the filter panel open', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/es/barcelona/cursos?maxPrice=invalid');
    await expect(page.locator('#filter-panel')).toHaveAttribute('open', '');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('#q')).toBeVisible();
  });
});

test('the city comes from the path: no location controls, kept across pages and languages', async ({
  page,
}) => {
  await page.goto('/es/barcelona/cursos');
  await expect(page.locator('#region, #city, [name="country"]')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Cursos y talleres en Barcelona',
  );
  await expect(page.locator('article.course')).toHaveCount(PAGE_SIZE);
  await page.getByRole('link', { name: /^Siguiente/ }).click();
  expect(query(page).get('page')).toBe('2');
  expect(query(page).has('city')).toBe(false);
  await page.getByRole('link', { name: 'Català', exact: true }).click();
  await expect(page).toHaveURL(/\/ca\/barcelona\/cursos\?page=2$/);
  // Zaragoza's search lists only Zaragoza courses, even with a stale city query.
  await page.goto('/es/zaragoza/cursos?city=barcelona&q=TEST');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Cursos y talleres en Zaragoza',
  );
  await expect(page.locator('article.course .institution')).not.toHaveCount(0);
  for (const name of await page
    .locator('article.course .institution')
    .allTextContents())
    expect(name).toMatch(/^Centro Cívico /);
});

test.describe('dynamic filter options', () => {
  test.use({ javaScriptEnabled: true });
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
  });
  test('centre changes update category options without navigation in both languages', async ({
    page,
  }) => {
    for (const [path, all, photography] of [
      [
        '/es/barcelona/cursos',
        'Todas las categorías',
        'Fotografía y audiovisual',
      ],
      [
        '/ca/barcelona/cursos',
        'Totes les categories',
        'Fotografia i audiovisual',
      ],
    ]) {
      await page.goto(path!);
      let navigations = 0;
      const countNavigation = () => navigations++;
      page.on('framenavigated', countNavigation);
      const url = page.url();
      await page.locator('#centre').focus();
      await page.locator('#centre').selectOption('cc-pati-llimona');
      await expect(page.locator('#category option')).toHaveText([
        all!,
        photography!,
        ...(path!.startsWith('/es')
          ? ['Danza y baile', 'Otros']
          : ['Dansa i ball', 'Altres']),
      ]);
      await expect(page.locator('#centre')).toBeFocused();
      await page.locator('#category').selectOption('fotografia-i-audiovisual');
      // The "all centres" option plus every seeded Barcelona centre, and no other city's.
      await expect(page.locator('#centre option')).toHaveCount(
        sources.filter((s) => s.institution.cityId === 'barcelona').length + 1,
      );
      await page.locator('#centre').selectOption('');
      await expect(page.locator('#category option')).not.toHaveCount(4);
      await expect(page.locator('.filter-form')).not.toHaveAttribute(
        'aria-busy',
      );
      expect(page.url()).toBe(url);
      expect(navigations).toBe(0);
      page.off('framenavigated', countNavigation);
    }
  });
  test('an unavailable search index is reported instead of stale results', async ({
    page,
  }) => {
    await page.route('**/search/barcelona/live.json', (route) =>
      route.fulfill({ status: 503, body: '' }),
    );
    await page.goto('/es/barcelona/cursos?q=TEST');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('article.course')).toHaveCount(0);
  });
  test('a search script that never loads stops showing the loading message', async ({
    page,
  }) => {
    await page.route('**/_astro/*.js', (route) => route.abort());
    await page.goto('/es/barcelona/cursos?q=TEST');
    await expect(page.locator('.search-loading')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('no está disponible', {
      timeout: 15_000,
    });
    await expect(page.locator('.search-loading')).toBeHidden();
    await expect(page.locator('[data-discovery-results]')).toBeHidden();
    await expect(
      page.getByRole('link', { name: 'Explorar por categoría' }),
    ).toBeVisible();
  });
});

test('places filter keeps its value in the URL and shows an applied chip', async ({
  page,
}) => {
  await page.goto('/es/barcelona/cursos?places=available');
  await expect(page.locator('#places')).toBeChecked();
  await expect(
    page.getByRole('link', { name: 'Quitar filtro: Ocultar sin plazas' }),
  ).toBeVisible();
  await page.goto('/es/barcelona/cursos?places=nope');
  await expect(page.getByRole('alert')).toContainText('Revisa los filtros');
});

test('audience filter narrows to courses for that audience', async ({
  page,
}) => {
  await page.goto('/es/barcelona/cursos');
  await page.getByLabel('Público', { exact: true }).selectOption('families');
  await submit(page);
  expect(query(page).get('audience')).toBe('families');
  await expect(page.locator('article.course h3')).toHaveText([
    'Fem galetes de gingebre per Nadal!',
  ]);
  await page.getByRole('link', { name: 'Català', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Treu el filtre: Públic: Famílies' }),
  ).toBeVisible();
  await page.goto('/es/barcelona/cursos?audience=adults');
  await expect(page.getByRole('alert')).toContainText('Revisa los filtros');
});

test('finished courses only appear in the archive, which keeps the filters and has a link from the search', async ({
  page,
}) => {
  await page.goto('/es/barcelona/cursos?q=TEST+finished');
  await expect(page.locator('article.course')).toHaveCount(0);
  await page
    .getByRole('link', { name: 'Archivo de cursos terminados' })
    .click();
  await expect(page).toHaveURL(/\/es\/barcelona\/cursos\?archive=1$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Archivo de cursos',
  );
  await expect(page.locator('#q')).toBeVisible();
  // Start months look back in the archive: newest first, so values descend.
  const months = await page
    .locator('#start option')
    .evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value).slice(1),
    );
  expect(months.length).toBeGreaterThan(1);
  expect(months).toEqual([...months].sort().reverse());
  await page.goto('/es/barcelona/cursos?archive=1&q=TEST+finished');
  await expect(page.locator('article.course h3')).toHaveText([
    'TEST finished workshop',
  ]);
  await page.goto('/ca/barcelona/cursos?archive=1&q=TEST+dance');
  await expect(page.locator('article.course')).toHaveCount(0);
  await page.goto('/es/barcelona/cursos?archive=2');
  await expect(page.getByRole('alert')).toContainText('Revisa los filtros');
});
