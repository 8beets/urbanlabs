import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });

test('Spanish homepage and Catalan language switching work without client JavaScript', async ({
  page,
}) => {
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
  await page.goto('/es/buscar');
  await page.getByLabel('Buscar por título').fill('no-such-course-abc123');
  await page.getByLabel('Precio máximo (€)').fill('20');
  await submit(page);
  expect(query(page).get('q')).toBe('no-such-course-abc123');
  expect(query(page).get('maxPrice')).toBe('20');
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

test('invalid URL filters return an accessible error and HTTP 400', async ({
  page,
}) => {
  expect((await page.goto('/es/buscar?page=-1'))?.status()).toBe(400);
  await expect(page.getByRole('alert')).toContainText('Revisa los filtros');
  await expect(page.locator('#q')).toHaveAttribute(
    'aria-describedby',
    'filter-error',
  );
});

test('categories compose with search, pagination, and locale switching without JavaScript', async ({
  page,
}) => {
  await page.goto('/es/buscar?page=2');
  const width = (await page.locator('#q').boundingBox())!.width;
  await page.getByLabel('Categoría', { exact: true }).selectOption('IDIOMES');
  await submit(page);
  expect(query(page).get('category')).toBe('IDIOMES');
  expect(query(page).has('page')).toBe(false);
  expect((await page.locator('#q').boundingBox())!.width).toBeCloseTo(width, 1);
  await page.getByRole('link', { name: /^Siguiente/ }).click();
  expect(query(page).get('page')).toBe('2');
  expect(query(page).get('category')).toBe('IDIOMES');
  await page.getByRole('link', { name: 'Català', exact: true }).click();
  await expect(page.getByLabel('Categoria', { exact: true })).toHaveValue(
    'IDIOMES',
  );
  expect(query(page).get('page')).toBe('2');
  await page.getByLabel('Cerca per títol').fill('ANGLÈS');
  await page.getByLabel('Preu màxim (€)').fill('20');
  await submit(page);
  await expect(page.locator('article.course')).toHaveCount(1);
  await expect(page.locator('article.course h3')).toHaveText(
    'Tertúlia literària en anglès',
  );
  await page.getByLabel('Categoria', { exact: true }).selectOption('BALL');
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
  await page.goto('/es/buscar?category=IDIOMES&page=2');
  await page.getByLabel('Centro', { exact: true }).selectOption('cc-can-baste');
  await submit(page);
  expect(query(page).get('centre')).toBe('cc-can-baste');
  expect(query(page).get('category')).toBe('IDIOMES');
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
  expect(query(page).get('category')).toBe('IDIOMES');
  await expect(page.locator('article.course')).toHaveCount(12);
  await page
    .getByRole('link', { name: 'Neteja els filtres', exact: true })
    .click();
  await page
    .getByLabel('Centre', { exact: true })
    .selectOption('cc-pati-llimona');
  await submit(page);
  await page.getByLabel('Categoria', { exact: true }).selectOption('CINEMA');
  await submit(page);
  await expect(page.locator('article.course')).toHaveCount(1);
  await expect(page.locator('article.course .institution')).toHaveText(
    'Centre Cívic Pati Llimona',
  );
});

test('photography aliases share one option and categories follow the selected centre', async ({
  page,
}) => {
  await page.goto('/es/buscar?category=ESPAI+FOTOGR%C3%80FIC+PATI+LLIMONA');
  await expect(page.locator('#category')).toHaveValue('FOTOGRAFIA');
  await expect(
    page.locator('#category option[value="FOTOGRAFIA"]'),
  ).toHaveCount(1);
  await expect(page.locator('article.course')).toHaveCount(4);
  await expect(page.locator('article.course .course-category')).toHaveText(
    Array(4).fill('Fotografía'),
  );
  await page
    .getByLabel('Centro', { exact: true })
    .selectOption('cc-pati-llimona');
  await submit(page);
  await expect(page.locator('#category option')).toHaveText([
    'Todas las categorías',
    'Cine',
    'Fotografía',
  ]);
  await expect(page.locator('article.course')).toHaveCount(2);
  await page.getByRole('link', { name: 'Català', exact: true }).click();
  await expect(page.locator('#category option')).toHaveText([
    'Totes les categories',
    'Cinema',
    'Fotografia',
  ]);
  await page.getByLabel('Centre', { exact: true }).selectOption('cc-can-baste');
  await submit(page);
  await expect(page.locator('#category option')).toHaveText([
    'Totes les categories',
    'Fotografia',
    'Idiomes',
  ]);
  await expect(page.locator('article.course')).toHaveCount(1);
  await page.getByLabel('Centre', { exact: true }).selectOption('');
  await submit(page);
  await expect(page.locator('#category option[value="BALL"]')).toHaveText(
    'Ball i dansa',
  );
  await expect(page.locator('article.course')).toHaveCount(4);
});

test('Golferichs filters its own normalized categories and retains official source links', async ({
  page,
}) => {
  await page.goto('/es/buscar');
  await page
    .getByLabel('Centro', { exact: true })
    .selectOption('cc-golferichs');
  await submit(page);
  await expect(page.locator('#category option')).toHaveText([
    'Todas las categorías',
    'Cocina',
    'Fotografía',
  ]);
  await expect(page.locator('article.course')).toHaveCount(2);
  await page
    .getByLabel('Categoría', { exact: true })
    .selectOption('FOTOGRAFIA');
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
    'Cuina',
    'Fotografia',
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
      'Actualidad e historia',
      'Actualitat i història',
    ],
    ['cc-albareda', 'Centre Cultural Albareda', 'Música', 'Música'],
    [
      'cc-el-sortidor',
      'Centre Cívic El Sortidor',
      'Talleres familiares',
      'Tallers familiars',
    ],
    [
      'cc-vil-la-urania',
      'Centre Cívic Vil·la Urània',
      'Arte y creatividad',
      'Art i creativitat',
    ],
    ['cc-urgell', 'Centre Cívic Urgell', 'Humanidades', 'Humanitats'],
    [
      'fab-casa-del-rellotge',
      'FAB Casa del Rellotge',
      'Nuevas tecnologías',
      'Noves tecnologies',
    ],
    [
      'fab-casa-del-mig',
      'FAB Casa del Mig',
      'Nuevas tecnologías',
      'Noves tecnologies',
    ],
  ]) {
    await page.goto('/es/buscar');
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
    await page.goto('/es/buscar');
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
    '/es/buscar?q=TEST&centre=cc-can-baste&category=IDIOMES&maxPrice=100&page=2&region=catalunya&city=barcelona',
  );
  await expect(
    page
      .getByRole('group', { name: 'Filtros aplicados', exact: true })
      .getByRole('link'),
  ).toHaveCount(6);
  await page
    .getByRole('link', { name: /^Quitar filtro: Precio máximo/ })
    .click();
  expect(query(page).has('maxPrice')).toBe(false);
  expect(query(page).has('page')).toBe(false);
  expect(query(page).get('centre')).toBe('cc-can-baste');
  expect(query(page).get('region')).toBe('catalunya');
  expect(query(page).get('city')).toBe('barcelona');
  await expect(page.locator('article.course')).toHaveCount(1);
  await page
    .getByRole('link', { name: /^Quitar filtro: Buscar por título/ })
    .click();
  expect(query(page).has('q')).toBe(false);
  await submit(page);
  expect(query(page).get('region')).toBe('catalunya');
  expect(query(page).get('city')).toBe('barcelona');
  await page
    .getByRole('link', { name: 'Limpiar filtros', exact: true })
    .click();
  await expect(page).toHaveURL('http://127.0.0.1:4322/es/buscar');
  await expect(
    page.getByRole('group', { name: 'Filtros aplicados', exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('#q')).toHaveValue('');
  await expect(page.locator('#centre')).toHaveValue('');
  await expect(page.locator('#category')).toHaveValue('');
  await expect(page.locator('#maxPrice')).toHaveValue('');
});

test('incompatible selected categories remain visible and removable', async ({
  page,
}) => {
  await page.goto('/es/buscar?centre=cc-pati-llimona&category=IDIOMES');
  await expect(page.locator('#category')).toHaveValue('IDIOMES');
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
  await expect(page.locator('article.course')).toHaveCount(3);
});

test('native filters are keyboard-collapsible without JavaScript and sit beside desktop results', async ({
  page,
}) => {
  await page.goto('/es/buscar');
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
});

test.describe('progressive filter panel', () => {
  test.use({ javaScriptEnabled: true });
  test('mobile starts collapsed, works by keyboard, and reopens on desktop resize', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/es/buscar');
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
    expect((await page.goto('/es/buscar?maxPrice=invalid'))?.status()).toBe(
      400,
    );
    await expect(page.locator('#filter-panel')).toHaveAttribute('open', '');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('#q')).toBeVisible();
  });
});

test('location controls default to Spain and preserve geography across languages', async ({
  page,
}) => {
  await page.goto('/es/buscar');
  await expect(page.locator('select[name="country"]')).toHaveCount(0);
  await expect(page.locator('input[name="country"]')).toHaveValue('ES');
  await page
    .getByLabel('Comunidad autónoma', { exact: true })
    .selectOption('catalunya');
  await page.getByLabel('Ciudad', { exact: true }).selectOption('barcelona');
  await submit(page);
  expect(query(page).get('country')).toBe('ES');
  await expect(page.locator('article.course')).toHaveCount(12);
  await page.getByRole('link', { name: /^Siguiente/ }).click();
  expect(query(page).get('region')).toBe('catalunya');
  expect(query(page).get('city')).toBe('barcelona');
  expect(query(page).get('page')).toBe('2');
  await page.getByRole('link', { name: 'Català', exact: true }).click();
  await expect(
    page.getByLabel('Comunitat autònoma', { exact: true }),
  ).toHaveValue('catalunya');
  await expect(page.getByLabel('Ciutat', { exact: true })).toHaveValue(
    'barcelona',
  );
  await page.getByLabel('Ciutat', { exact: true }).selectOption('tarragona');
  await submit(page);
  await expect(page.locator('article.course')).toHaveCount(0);
  await expect(page.locator('.empty')).toContainText(
    'Encara no hi ha cursos publicats en aquesta ubicació.',
  );
  await expect(page.locator('.empty a')).toHaveCount(0);
  await expect(page.locator('#centre option')).toHaveCount(1);
  await expect(page.locator('#category option')).toHaveCount(1);
});

test.describe('dependent city controls', () => {
  test.use({ javaScriptEnabled: true });
  test('changing region clears the city and waits for explicit submission', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/es/buscar?region=catalunya&city=barcelona');
    await page.locator('#region').selectOption('');
    await expect(page.locator('#city')).toHaveValue('');
    expect(query(page).get('city')).toBe('barcelona');
    await page.locator('#region').selectOption('catalunya');
    await expect(page.locator('#city option')).toHaveText([
      'Todas las ciudades',
      'Barcelona',
      'Tarragona',
    ]);
    await page.locator('#city').selectOption('tarragona');
    await submit(page);
    expect(query(page).get('city')).toBe('tarragona');
    await expect(page.locator('article.course')).toHaveCount(0);
  });
});
