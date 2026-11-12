import { expect, test } from '@playwright/test';
import { signToken } from '../../src/lib/alerts/subscription';
import { E2E_ALERT_SECRET, e2eAlertId } from './alert-fixtures';

// The Turnstile widget is a third-party script; routine tests never load it.
test.beforeEach(async ({ page }) => {
  await page.route('https://challenges.cloudflare.com/**', (route) =>
    route.abort(),
  );
});

test('search links to an alert form prefilled with category and city', async ({
  page,
}) => {
  await page.goto('/es/barcelona/cursos?category=idiomes');
  await page
    .getByRole('link', {
      name: 'Recibe avisos de cursos nuevos de esta búsqueda',
    })
    .click();
  await expect(page).toHaveURL(
    /\/es\/alertas\?category=idiomes&city=barcelona$/,
  );
  await expect(page).toHaveTitle('Avisos de cursos nuevos · UrbanLabs');
  await expect(page.getByLabel('Categoría')).toHaveValue('idiomes');
  await expect(page.getByLabel('Ciudad')).toHaveValue('barcelona');
  await expect(page.getByLabel('Correo electrónico')).toBeVisible();
  await expect(
    page.getByText('Los avisos se envían a través de Brevo'),
  ).toBeVisible();
  const response = await page.request.get('/es/alertas');
  expect(response.headers()['cache-control']).toBe('no-store');
});

test('reports invalid input accessibly before any verification', async ({
  page,
}) => {
  await page.goto('/ca/alertes?category=idiomes');
  await expect(page.getByLabel('Categoria')).toHaveValue('idiomes');
  await page.getByLabel('Correu electrònic').fill('no-és-un-correu');
  await page.getByRole('button', { name: 'Crear l’avís' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Escriu una adreça de correu vàlida.',
  );
  await expect(page.getByLabel('Correu electrònic')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await page.getByLabel('Correu electrònic').fill('ana@example.invalid');
  await page.getByLabel('Categoria').selectOption('');
  await page.getByRole('button', { name: 'Crear l’avís' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Tria una categoria o una ciutat de la llista.',
  );
  // Without the (blocked) Turnstile widget there is no token, so nothing is stored or sent.
  await page.getByLabel('Categoria').selectOption('idiomes');
  await page.getByRole('button', { name: 'Crear l’avís' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'No hem pogut comprovar que no ets un robot. Torna-ho a provar.',
  );
});

test('confirm and unsubscribe links act only after an explicit button press', async ({
  page,
}, testInfo) => {
  const id = e2eAlertId(testInfo.project.name);
  const confirmToken = await signToken(E2E_ALERT_SECRET, 'confirm', id);
  await page.goto(`/es/alertas/confirmar?token=${confirmToken}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Confirmar el aviso',
  );
  await expect(page.getByText('Idiomas en Barcelona')).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar aviso' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Aviso confirmado. Recibirás un correo semanal cuando haya cursos nuevos.',
  );

  const unsubscribeToken = await signToken(E2E_ALERT_SECRET, 'unsubscribe', id);
  // The confirm token cannot unsubscribe.
  await page.goto(`/ca/alertes/baixa?token=${confirmToken}`);
  await expect(page.getByRole('alert')).toHaveText(
    'Aquest enllaç no és vàlid o l’avís ja no existeix.',
  );
  await page.goto(`/ca/alertes/baixa?token=${unsubscribeToken}`);
  await page.getByRole('link', { name: 'Español' }).click();
  await expect(page).toHaveURL(`/es/alertas/baja?token=${unsubscribeToken}`);
  await page.getByRole('button', { name: 'Darme de baja' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Te has dado de baja y hemos borrado este aviso.',
  );
  await page.goto(`/es/alertas/baja?token=${unsubscribeToken}`);
  await expect(page.getByRole('alert')).toHaveText(
    'Este enlace no es válido o el aviso ya no existe.',
  );
});

test('accepts an RFC 8058 one-click unsubscribe POST without a browser origin', async ({
  request,
}, testInfo) => {
  const id = e2eAlertId(testInfo.project.name, 'oneClick');
  const token = await signToken(E2E_ALERT_SECRET, 'unsubscribe', id);
  const url = `/es/alertas/baja?token=${token}`;
  const response = await request.post(url, {
    form: { 'List-Unsubscribe': 'One-Click' },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('no-store');
  expect((await request.post(url, { form: {} })).status()).toBe(404);
});
