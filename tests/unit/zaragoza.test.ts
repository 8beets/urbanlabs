import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createZaragozaAdapter,
  currentProgramme,
  parseZaragozaList,
} from '../../src/lib/ingestion/adapters/zaragoza-centros-civicos';
import { adapterFor } from '../../src/lib/ingestion/adapters';
import { assertRobotsAllowPath } from '../../src/lib/ingestion/robots';
import { courseRecordSchema } from '../../src/lib/ingestion/validation/record';
import { toSourceConfig } from '../../src/lib/centres/schema';
import { centres } from '../../src/lib/centres/registry';
import { courseTopic } from '../../src/lib/courses/categories';

const fixture = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8'),
  );
const universidad = fixture('zaragoza-universidad');
const programmes = fixture('zaragoza-programmes');
const source = toSourceConfig(
  centres.find((c) => c.id === 'cc-zgz-universidad')!,
);
// The real robots.txt of www.zaragoza.es on 2026-11-12 (`User-agent: *` group).
const robots = `# Block Baidu
User-agent: Baiduspider
Disallow: /ciudad/servicios/buscar*

User-agent: *
Disallow: /api/
Disallow: /buscador/
Disallow: /*jsessionid
#Disallow: /*fq=
Disallow: /*.csv
Disallow: /*.geojson
`;

describe('Zaragoza civic-centre parsing', () => {
  it('picks the newest season programme by its title', () => {
    expect(currentProgramme(programmes)).toBe(2425);
    expect(() => currentProgramme({ result: [] })).toThrow('not found');
  });

  it('maps real courses with season dates, weekly sessions, organiser and unknown price', () => {
    const records = parseZaragozaList(universidad, 2119);
    for (const record of records)
      expect(courseRecordSchema.safeParse(record).success).toBe(true);
    expect(records.find((r) => r.externalId === '313154')).toEqual({
      externalId: '313154',
      title: 'Pilates y fuerza (Barre)',
      officialUrl:
        'https://www.zaragoza.es/sede/portal/centroscivicos/servicio/cultura/evento/313154',
      category: 'Deporte',
      startDate: '2026-09-07',
      endDate: '2027-06-20',
      scheduleText:
        'Lunes 09:30–10:30 · Lunes 15:30–16:30 · Miércoles 09:30–10:30 · Miércoles 15:30–16:30',
      priceCents: null,
      currency: null,
      availability: null,
      isCancelled: false,
      isSoldOut: false,
      organizer: 'Asociación de Mujeres AGUA',
      courseLanguage: null,
    });
    // Events without a named organiser keep it unknown.
    expect(
      records.find((r) => r.title === 'Coro Gospel Aragón')!.organizer,
    ).toBeNull();
    // A session note qualifies the weekly time instead of being dropped.
    expect(
      records.find((r) => r.title === 'Escritura creativa')!.scheduleText,
    ).toBe('Miércoles 19:00–21:00. Los tres primeros miércoles de cada mes');
  });

  it('leaves out rehearsals, meetings and members’ days', () => {
    const titles = parseZaragozaList(universidad, 2119).map((r) => r.title);
    expect(titles).toHaveLength(8);
    for (const title of [
      'Ensayo Banda del Canal',
      'Reuniones filatelia',
      'Día del socio',
    ])
      expect(titles).not.toContain(title);
    expect(titles).toContain('Coro Gospel Aragón');
  });

  it('lists dance classes in the music and sport categories as dance', () => {
    const records = parseZaragozaList(universidad, 2119);
    const topic = (title: string) =>
      courseTopic(records.find((r) => r.title === title)!);
    expect(topic('Bailes y coreografías')).toBe('dansa');
    expect(topic('Bailes Latinos')).toBe('dansa');
    expect(topic('Coro Gospel Aragón')).toBe('musica');
    expect(topic('Pilates y fuerza (Barre)')).toBe('activitat-fisica');
    expect(topic('Clases de español A2 aprendizaje lento')).toBe('idiomes');
  });

  it('rejects an event at another centre, an incomplete or a changed listing', () => {
    expect(() => parseZaragozaList(universidad, 4006)).toThrow(
      'another centre',
    );
    expect(() =>
      parseZaragozaList({ ...universidad, totalCount: 600 }, 2119),
    ).toThrow('incomplete');
    const changed = structuredClone(universidad);
    changed.result[0].subEvent[0].openingHours[0].startTime = '9h';
    expect(() => parseZaragozaList(changed, 2119)).toThrow();
  });

  it('leaves an unparseable date unknown and accepts a course without sessions', () => {
    const odd = structuredClone(universidad);
    odd.result[1].subEvent[0].startDate = 'pronto';
    delete odd.result[1].subEvent[0].openingHours;
    const record = parseZaragozaList(odd, 2119)[1]!;
    expect(record.startDate).toBeNull();
    expect(record.scheduleText).toBeNull();
  });
});

describe('robots.txt path rules', () => {
  it('allows the JSON paths and blocks disallowed ones', () => {
    expect(() =>
      assertRobotsAllowPath(
        robots,
        '/sede/servicio/cultura/evento/list.json?program.id=2425&idLugar=2119',
      ),
    ).not.toThrow();
    for (const path of [
      '/api/recurso/cultura-ocio/evento-zaragoza/1',
      '/sede/servicio/cultura/evento/list.csv?rows=5',
      '/x;jsessionid=1',
    ])
      expect(() => assertRobotsAllowPath(robots, path)).toThrow('robots.txt');
    expect(() =>
      assertRobotsAllowPath('User-agent: *\nDisallow: /a$', '/a/b'),
    ).not.toThrow();
    expect(() =>
      assertRobotsAllowPath('User-agent: *\nDisallow: /', '/anything'),
    ).toThrow('robots.txt');
  });
});

describe('Zaragoza fetching', () => {
  const run = (robotsText: string, list = universidad) => {
    const requests: string[] = [];
    const adapter = createZaragozaAdapter({
      intervalMs: 0,
      sleep: async () => {},
      fetch: async (input) => {
        const url = String(input);
        requests.push(url);
        if (url.endsWith('/robots.txt')) return new Response(robotsText);
        if (url.includes('programa-list.json'))
          return new Response(JSON.stringify(programmes));
        return new Response(JSON.stringify(list));
      },
    });
    return { adapter, requests };
  };

  it('checks robots.txt, finds the season and reads only the centre listing', async () => {
    const { adapter, requests } = run(robots);
    expect(await adapter.fetchRecords(source)).toHaveLength(8);
    expect(requests).toEqual([
      'https://www.zaragoza.es/robots.txt',
      'https://www.zaragoza.es/sede/servicio/actividades/evento/programa-list.json?rows=50&q=title==*Centros*&sort=id%20desc',
      'https://www.zaragoza.es/sede/servicio/cultura/evento/list.json?program.id=2425&idLugar=2119&rows=500&sort=id%20asc',
    ]);
  });

  it('stops on a stricter robots policy or an empty listing', async () => {
    await expect(
      run('User-agent: *\nDisallow: /sede/').adapter.fetchRecords(source),
    ).rejects.toThrow('robots.txt');
    await expect(
      run(robots, { totalCount: 0, result: [] }).adapter.fetchRecords(source),
    ).rejects.toThrow('No course records');
  });

  it('is selected by platform and lists every centre by its facility id', () => {
    expect(typeof adapterFor(source).fetchRecords).toBe('function');
    expect(source.listingUrl).toBe(
      'https://www.zaragoza.es/sede/servicio/cultura/evento/list?idLugar=2119',
    );
    const zaragoza = centres.filter((c) => c.cityId === 'zaragoza');
    expect(zaragoza).toHaveLength(23);
    expect(zaragoza.every((c) => !c.pausedReason)).toBe(true);
  });
});
