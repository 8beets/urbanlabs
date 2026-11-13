import { expect, it } from 'vitest';
import {
  RESERVED_SEGMENTS,
  aboutPath,
  centreDirectoryPath,
  centrePath,
  citiesCentresPath,
  citiesCoursesPath,
  cityPath,
  courseSearchPath,
  homePath,
  topicPath,
} from '../../src/i18n/paths';
import { sourceCities } from '../../src/lib/sources';
import { centres } from '../../src/lib/centres/registry';

it('generates prefixed home URLs and the city lists for every locale', () => {
  expect(homePath('es')).toBe('/es/');
  expect(homePath('ca')).toBe('/ca/');
  expect(citiesCoursesPath('es')).toBe('/es/cursos');
  expect(citiesCentresPath('es')).toBe('/es/centros');
  expect(citiesCentresPath('ca')).toBe('/ca/centres');
});

it('puts courses and centres under the city id in every locale', () => {
  expect(cityPath('ca', 'zaragoza')).toBe('/ca/zaragoza/');
  expect(courseSearchPath('es', 'zaragoza')).toBe('/es/zaragoza/cursos');
  expect(courseSearchPath('ca', 'zaragoza')).toBe('/ca/zaragoza/cursos');
  expect(topicPath('es', 'barcelona', 'idiomes')).toBe(
    '/es/barcelona/cursos/idiomes',
  );
  expect(centreDirectoryPath('ca', 'barcelona')).toBe('/ca/barcelona/centres');
  expect(centrePath('es', 'barcelona', 'sant-andreu')).toBe(
    '/es/barcelona/centros/sant-andreu',
  );
});

it('lists the cities with an approved source; no city id is a fixed section', () => {
  expect(sourceCities().map((city) => city.id)).toEqual([
    'barcelona',
    'girona',
    'zaragoza',
  ]);
  // Every fixed section's localized segment is reserved.
  for (const locale of ['es', 'ca'] as const)
    expect(RESERVED_SEGMENTS).toContain(
      aboutPath(locale).split('/')[2] as never,
    );
  for (const centre of centres)
    expect(RESERVED_SEGMENTS).not.toContain(centre.cityId as never);
});
