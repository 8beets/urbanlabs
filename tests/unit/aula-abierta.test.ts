import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createAulaAbiertaAdapter,
  parseAulaAbiertaPage,
} from '../../src/lib/ingestion/adapters/aula-abierta';
import { adapterFor } from '../../src/lib/ingestion/adapters';
import { courseRecordSchema } from '../../src/lib/ingestion/validation/record';
import { toSourceConfig } from '../../src/lib/centres/schema';
import { centres } from '../../src/lib/centres/registry';
import type { SourceConfig } from '../../src/lib/ingestion/types';

const base = 'https://w3.alicante.es/cultura/aula-abierta/consulta-cursos.php';
const fixture = (name: string) =>
  readFileSync(new URL(`../fixtures/${name}.html`, import.meta.url), 'utf8');
const chalet = fixture('alicante-aula-abierta-chalet');

const source: SourceConfig = toSourceConfig(
  centres.find((c) => c.id === 'alc-chalet-ingeniero-de-tranvias')!,
);

describe('Alicante Aula Abierta adapter', () => {
  it('parses real saved courses with ISO dates, schedule and unknown price', () => {
    const parsed = parseAulaAbiertaPage(chalet, `${base}?aula=301`);
    expect(parsed).toHaveLength(5);
    expect(parsed.every((course) => course.aula === '301')).toBe(true);
    const records = parsed.map((course) => course.record);
    expect(records[0]).toMatchObject({
      title: 'ACTIVIDAD FÍSICA: CHI KUNG.',
      category: 'SALUD Y DESARROLLO PERSONAL',
      startDate: '2026-10-21',
      endDate: '2027-06-16',
      scheduleText: 'Miércoles, 10:30h - 11:30h',
      priceCents: null,
      currency: null,
      isCancelled: false,
      isSoldOut: false,
      officialUrl: `${base}?aula=301&especialidad=34`,
    });
    for (const record of records)
      expect(courseRecordSchema.safeParse(record).success).toBe(true);
  });
  it('keeps courses that share a code inside one specialty apart', () => {
    const records = parseAulaAbiertaPage(chalet, `${base}?aula=301`).map(
      (course) => course.record,
    );
    const shared = records.filter((r) => r.externalId.startsWith('8-'));
    expect(shared).toHaveLength(2);
    expect(new Set(shared.map((r) => r.externalId)).size).toBe(2);
    expect(new Set(records.map((r) => r.externalId)).size).toBe(5);
  });
  it('treats only the explicit "Gratuito" label as a price', () => {
    const records = parseAulaAbiertaPage(
      fixture('alicante-aula-abierta-juan-xxiii'),
      `${base}?aula=402`,
    ).map((course) => course.record);
    expect(records.map((r) => r.priceCents).sort()).toEqual([0, null]);
    expect(records.find((r) => r.priceCents === 0)!.currency).toBe('EUR');
  });
  it('rejects a changed page and conflicting duplicates', () => {
    expect(() => parseAulaAbiertaPage('<html>Login</html>', base)).toThrow(
      'structure changed',
    );
    expect(() =>
      parseAulaAbiertaPage(chalet.replace(/data-codigo="\d+"/, ''), base),
    ).toThrow('stable identity');
  });
  it('leaves unparseable dates unknown instead of guessing', () => {
    const odd = chalet.replace('21-10-2026 a 16-06-2027', 'próximamente');
    const first = parseAulaAbiertaPage(odd, `${base}?aula=301`)[0]!.record;
    expect(first.startDate).toBeNull();
    expect(first.endDate).toBeNull();
  });
});

describe('Aula Abierta fetching', () => {
  const run = (pages: Record<string, Response | string>) => {
    const requests: string[] = [];
    const adapter = createAulaAbiertaAdapter({
      intervalMs: 0,
      sleep: async () => {},
      fetch: async (input) => {
        const url = String(input);
        requests.push(url);
        if (url.endsWith('/robots.txt'))
          return pages.robots instanceof Response
            ? pages.robots
            : new Response('', { status: 404 });
        return new Response(String(pages.listing), { status: 200 });
      },
    });
    return { adapter, requests };
  };
  it('fetches only the approved classroom page after checking robots.txt', async () => {
    const { adapter, requests } = run({ listing: chalet });
    const records = await adapter.fetchRecords(source);
    expect(records).toHaveLength(5);
    expect(records[0]).not.toHaveProperty('aula');
    expect(requests).toEqual([
      'https://w3.alicante.es/robots.txt',
      `${base}?aula=301`,
    ]);
  });
  it('fails safely on a robots policy, another classroom or an empty listing', async () => {
    await expect(
      run({
        robots: new Response('User-agent: *\nDisallow: /', { status: 200 }),
        listing: chalet,
      }).adapter.fetchRecords(source),
    ).rejects.toThrow('robots.txt');
    await expect(
      run({ listing: chalet }).adapter.fetchRecords({
        ...source,
        listingUrl: `${base}?aula=302`,
      }),
    ).rejects.toThrow('another classroom');
    await expect(
      run({
        listing: chalet.replace(/<li class="list-group-item[\s\S]*<\/li>/, ''),
      }).adapter.fetchRecords(source),
    ).rejects.toThrow('No course records');
  });
  it('is selected by platform', () => {
    expect(typeof adapterFor(source).fetchRecords).toBe('function');
  });
});
