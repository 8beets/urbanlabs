import { expect, it } from 'vitest';
import {
  courseSearchPath,
  hasDiscoveryParams,
  homePath,
  centreDirectoryPath,
} from '../../src/i18n/paths';

it('generates home and centre URLs from the Astro locale configuration', () => {
  expect(homePath('es')).toBe('/es/');
  expect(homePath('ca')).toBe('/ca/');
  expect(centreDirectoryPath('es')).toBe('/es/centros');
  expect(centreDirectoryPath('ca')).toBe('/ca/centres');
});

it('uses explicit localized search URLs', () => {
  expect(courseSearchPath('es')).toBe('/es/buscar');
  expect(courseSearchPath('ca')).toBe('/ca/cerca');
});
it('identifies legacy filters without moving ordinary homepage links', () => {
  for (const key of [
    'q',
    'category',
    'centre',
    'maxPrice',
    'page',
    'region',
    'city',
  ])
    expect(hasDiscoveryParams(new URLSearchParams(`${key}=`))).toBe(true);
  expect(hasDiscoveryParams(new URLSearchParams())).toBe(false);
  expect(hasDiscoveryParams(new URLSearchParams('utm_source=slack'))).toBe(
    false,
  );
});
