import { expect, test } from '@playwright/test';

for (const javaScriptEnabled of [false, true]) {
  test.describe(`Alicante filters with JavaScript ${javaScriptEnabled ? 'enabled' : 'disabled'}`, () => {
    test.use({ javaScriptEnabled });
    test('filters by community and city and preserves the selection across languages', async ({
      page,
    }) => {
      await page.goto('/es/buscar');
      if (javaScriptEnabled && page.viewportSize()!.width < 800)
        await page.locator('#filter-panel summary').click();
      await page
        .locator('#region')
        .selectOption({ label: 'Comunidad Valenciana' });
      if (!javaScriptEnabled) {
        await page.locator('button[type="submit"]').click();
      }
      await expect(page.locator('#city option[value="alicante"]')).toHaveText(
        'Alicante',
      );
      await expect(page.locator('#city option[value="barcelona"]')).toHaveCount(
        0,
      );
      await page.locator('#city').selectOption('alicante');
      await expect(page.locator('button[type="submit"]')).toBeEnabled();
      await page.locator('button[type="submit"]').click();
      expect(new URL(page.url()).searchParams.get('city')).toBe('alicante');
      await expect(page.locator('article.course')).toHaveCount(0);
      await expect(page.locator('.empty')).toContainText(
        'Todavía no hay cursos publicados en esta ubicación.',
      );
      await expect(page.locator('.empty a')).toHaveCount(0);
      await page.getByRole('link', { name: 'Català', exact: true }).click();
      await expect(page.locator('#region')).toHaveValue('comunitat-valenciana');
      await expect(page.locator('#city')).toHaveValue('alicante');
      await expect(page.locator('#region option:checked')).toHaveText(
        'Comunitat Valenciana',
      );
      await expect(page.locator('#city option:checked')).toHaveText('Alacant');
      await expect(
        page.getByRole('group', { name: 'Filtres aplicats', exact: true }),
      ).toContainText('Ciutat: Alacant');
      await expect(page.locator('.empty')).toContainText(
        'Encara no hi ha cursos publicats en aquesta ubicació.',
      );
      if (javaScriptEnabled) {
        if (page.viewportSize()!.width < 800)
          await page.locator('#filter-panel summary').click();
        await page.locator('#region').selectOption('catalunya');
        await page.locator('#region').selectOption('comunitat-valenciana');
        await expect(page.locator('#city option[value="alicante"]')).toHaveText(
          'Alacant',
        );
      }
    });
  });
}
