import { describe, expect, it } from 'vitest';
import {
  TOPICS,
  courseAudience,
  courseTopic,
  unmappedCategories,
} from '../../src/lib/courses/categories';
import { categoryLabel } from '../../src/i18n/ui';
import { parseFilters } from '../../src/lib/courses/discovery';

// Category and title pairs are real production values (issue #95).
describe('course topics', () => {
  it.each([
    [
      'ESPAI FOTOGRÀFIC PATI LLIMONA',
      'Taller X-Ville',
      'fotografia-i-audiovisual',
    ],
    [' idiomes ', 'SPEAK UP!', 'idiomes'],
    ['Cuina', 'Sabors de tardor', 'cuina'],
    ['DANSA', 'MOVIMENT, EXPRESSIÓ I PERCEPCIÓ', 'dansa'],
    ['SALUT I BENESTAR', "POSA'T + A", 'activitat-fisica'],
    ['Art i pensament', 'Els estils cinematogràfics', 'humanitats-i-ciencia'],
  ])('maps the reviewed category %s', (category, title, topic) => {
    expect(courseTopic({ category, title })).toBe(topic);
  });

  it.each([
    ['EXPRESSIÓ', 'GIMNÀSTICA SUAU (Dv 10.30h)', 'activitat-fisica'],
    ['EXPRESSIÓ', 'Sevillanes', 'dansa'],
    ['EXPRESSIÓ', 'Improvisació teatral', 'teatre'],
    ['Recursos', 'INTRODUCCIÓ A L’ÀRAB', 'idiomes'],
    ['Recursos', 'Costura', 'arts-i-manualitats'],
    ['SALUT I CREIXEMENT PERSONAL', 'ACTIVA LA MENT', 'benestar'],
    ['COMUNITAT DIGITAL', 'CLUB DE LA FOTOGRAFIA', 'fotografia-i-audiovisual'],
    ['FAMILIARS', 'CIRC AERI EN FAMÍLIA', 'teatre'],
    // "Dj" is dijous (Thursday), not a DJ course.
    ['CREATIVITAT', 'PINTURA A L’OLI (Dj 18.30h)', 'arts-i-manualitats'],
    ['TROBA’T', 'IMPROVE YOUR ENGLISH', 'idiomes'],
    ['Expressió', 'Ball flamenc i àrab', 'dansa'],
    ['Persones Grans', 'Món digital: IA, núvol i seguretat', 'tecnologia'],
  ])(
    'classifies the mixed category %s by the title %s',
    (category, title, topic) => {
      expect(courseTopic({ category, title })).toBe(topic);
    },
  );

  it('falls back to Altres instead of guessing', () => {
    expect(courseTopic({ category: 'Recursos', title: 'Escacs' })).toBe(
      'altres',
    );
    expect(courseTopic({ category: 'NOVA CATEGORIA', title: 'Xyz' })).toBe(
      'altres',
    );
    expect(courseTopic({ category: null, title: 'Pilates' })).toBe(
      'activitat-fisica',
    );
  });

  it('accepts only topic ids as the category filter', () => {
    expect(parseFilters(new URLSearchParams('category=idiomes')).category).toBe(
      'idiomes',
    );
    for (const value of [
      'IDIOMES',
      'ESPAI FOTOGRÀFIC',
      "' OR 1=1 --",
      '__proto__',
    ])
      expect(() =>
        parseFilters(new URLSearchParams({ category: value })),
      ).toThrow('Invalid category');
  });

  it('labels every topic in both locales', () => {
    for (const topic of TOPICS)
      for (const locale of ['es', 'ca'] as const)
        expect(categoryLabel(topic, locale)).not.toBe(topic);
    expect(categoryLabel('fotografia-i-audiovisual', 'es')).toBe(
      'Fotografía y audiovisual',
    );
  });

  it('lists source categories missing from the reviewed tables', () => {
    expect(
      unmappedCategories(['IDIOMES', 'Idiomes', 'Monografics', 'NOVA', 'NOVA']),
    ).toEqual(['NOVA']);
  });
});

describe('course audiences', () => {
  it.each([
    ['Activitats familiars', 'Tarda de jocs', 'families'],
    [
      'INFANTILS i JUVENILS',
      'CERÀMICA INFANTIL (de 9 a 12 anys)',
      'infants-i-joves',
    ],
    ['Persones Grans', 'Memòria (Grup F)', 'gent-gran'],
    ['Música', 'Música en família', 'families'],
    [
      'Benestar personal',
      'IOGA SUAU PER A GENT GRAN - dones Raval +65',
      'gent-gran',
    ],
    ['Danses', 'Dancehall (curs subvencionat per a joves)', 'infants-i-joves'],
    [
      'Cos i moviment',
      'Moviment Conscient per a Dones Majors de 40 Anys',
      'dones',
    ],
    ['Habilitats i competències', 'Genealogia i història familiar', null],
    ['COR', 'COR JOVE B', null],
    ['DONA', 'IOGA RESTAURADOR', 'dones'],
    ['Espai Dona', "EL VENTRE DE LES DEESES D'EGIPTE", 'dones'],
    ['COS', 'Ioga per a la Dona - NOU', 'dones'],
    ['Salut i esport', 'Autodefensa feminista', 'dones'],
    ['Art i creació', 'Dones que pinten flors (Dimarts 17 h)', null],
  ])('reads %s / %s as %s', (category, title, audience) => {
    expect(courseAudience({ category, title })).toBe(audience);
  });

  it('validates the audience filter', () => {
    expect(
      parseFilters(new URLSearchParams('audience=gent-gran')).audience,
    ).toBe('gent-gran');
    expect(() => parseFilters(new URLSearchParams('audience=adults'))).toThrow(
      'Invalid audience filter',
    );
  });
});
