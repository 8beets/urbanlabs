import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { m } from '../../src/paraglide/messages.js';
import { baseLocale, locales } from '../../src/paraglide/runtime.js';
import { categoryLabel, pageErrorMessage } from '../../src/i18n/ui';
import { cityLabel } from '../../src/i18n/geography';
import { formatSchedule } from '../../src/i18n/schedule';
import astroConfig from '../../astro.config.mjs';

function catalog(locale: string): Record<string, string> {
  return JSON.parse(
    readFileSync(
      new URL(`../../messages/${locale}.json`, import.meta.url),
      'utf8',
    ),
  );
}

describe('Paraglide translation catalogs', () => {
  it('keeps translated keys and routing locales complete and in sync', () => {
    expect(baseLocale).toBe(astroConfig.i18n?.defaultLocale);
    expect([...locales]).toEqual(astroConfig.i18n?.locales);
    const spanish = catalog('es');
    for (const locale of locales) {
      const translations = catalog(locale);
      expect(Object.keys(translations).sort()).toEqual(
        Object.keys(spanish).sort(),
      );
      for (const [key, text] of Object.entries(translations)) {
        expect(text.trim(), `${locale}.${key}`).not.toBe('');
        expect(Object.hasOwn(m, key), key).toBe(true);
        // Formatted placeholders ("{date: datetime …}") are covered by their callers' tests.
        if (/\{\w+: /.test(text)) continue;
        const message = m[key as keyof typeof m] as (
          inputs: Record<string, string>,
          options: { locale: typeof locale },
        ) => string;
        // Passing each placeholder its own literal name must reproduce the catalog text.
        const inputs = Object.fromEntries(
          [...text.matchAll(/\{(\w+)\}/g)].map(([placeholder, name]) => [
            name!,
            placeholder,
          ]),
        );
        expect(message(inputs, { locale }), `${locale}.${key}`).toBe(text);
      }
    }
  });

  it('keeps explicit locales isolated across interleaved asynchronous work', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, async (_, index) => {
        const locale = index % 2 ? 'ca' : 'es';
        await new Promise((resolve) => setTimeout(resolve, index % 3));
        return [
          m.searchTitle({}, { locale }),
          categoryLabel('fotografia-i-audiovisual', locale),
          cityLabel({ id: 'alicante', name: 'Alicante' }, locale),
          formatSchedule('Dilluns i dimarts', locale),
          pageErrorMessage('invalid', locale),
        ];
      }),
    );
    for (const [index, result] of results.entries()) {
      const translations = catalog(index % 2 ? 'ca' : 'es');
      expect(result).toEqual([
        translations.searchTitle,
        translations.topicPhotography,
        index % 2 ? 'Alacant' : 'Alicante',
        index % 2 ? 'Dilluns i dimarts' : 'Lunes y martes',
        translations.invalid,
      ]);
    }
  });
});
