import { expect, it } from 'vitest';
import {
  courseSearchPath,
  homePath,
  centreDirectoryPath,
} from '../../src/i18n/paths';

it('generates prefixed home and centre URLs for every locale', () => {
  expect(homePath('es')).toBe('/es/');
  expect(homePath('ca')).toBe('/ca/');
  expect(centreDirectoryPath('es')).toBe('/es/centros');
  expect(centreDirectoryPath('ca')).toBe('/ca/centres');
});

it('uses explicit localized search URLs', () => {
  expect(courseSearchPath('es')).toBe('/es/buscar');
  expect(courseSearchPath('ca')).toBe('/ca/cerca');
});
