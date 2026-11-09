import { load } from 'cheerio';
import { format, isValid, parse } from 'date-fns';
import { cleanText } from '../normalization/values';
import { createSourceFetcher, type FetchOptions } from '../http';
import { ISO_DATE } from '../../time/dates';
import type { CourseRecord, SourceAdapter, SourceConfig } from '../types';

// Alicante's "Aula Abierta" (municipal culture classes). One server-rendered page
// per classroom (`?aula=<code>`): <h3> specialty headings, each followed by a list of
// courses. The page offers no per-course URL or identifier that is unique on its own.

const slug = (text: string, max: number) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max)
    .replace(/-$/, '');

function localDate(value: string): string | null {
  const date = parse(value, 'dd-MM-yyyy', new Date(0));
  return isValid(date) ? format(date, ISO_DATE) : null;
}

export interface AulaAbiertaCourse {
  /** Classroom code from the page, used to check the page matches the request. */
  aula: string;
  record: CourseRecord;
}

export function parseAulaAbiertaPage(
  html: string,
  pageUrl: string,
): AulaAbiertaCourse[] {
  const $ = load(html);
  if (!$('#form_consulta_cursos').length || !$('#especialidad').length)
    throw new Error('Aula Abierta listing structure changed');
  const specialtyIds = new Map(
    $('#especialidad option[value]')
      .map((_, option) => [
        [cleanText($(option).text()), $(option).attr('value') ?? ''] as const,
      ])
      .get()
      .filter(([, id]) => /^\d+$/.test(id)),
  );
  const records = new Map<string, AulaAbiertaCourse>();
  $('main h3').each((_, heading) => {
    const category = cleanText($(heading).text());
    const specialtyId = specialtyIds.get(category);
    $(heading)
      .nextAll('ul')
      .first()
      .find('li.curso')
      .each((_, element) => {
        const item = $(element);
        const aula = item.attr('data-aula') ?? '';
        const code = item.attr('data-codigo') ?? '';
        const title = cleanText(item.find('.curso_nombre').text());
        if (!/^\d+$/.test(aula) || !/^\d+$/.test(code) || !title)
          throw new Error('Aula Abierta course has no stable identity');
        // The code is only unique within a specialty heading, and some pages repeat
        // it for different courses, so the title is part of the identity.
        const externalId = `${code}-${slug(category, 40)}-${slug(title, 60)}`;
        const dates = cleanText(item.find('.curso_fechas').text()).match(
          /^(\d{2}-\d{2}-\d{4})(?: a (\d{2}-\d{2}-\d{4}))?$/u,
        );
        const startDate = dates ? localDate(dates[1]!) : null;
        const endDate = dates?.[2] ? localDate(dates[2]) : startDate;
        const query = new URLSearchParams({ aula });
        if (specialtyId) query.set('especialidad', specialtyId);
        const record: CourseRecord = {
          externalId,
          title,
          officialUrl: `${new URL(pageUrl).origin}${new URL(pageUrl).pathname}?${query}`,
          category,
          startDate,
          endDate,
          scheduleText: cleanText(item.find('.curso_dias').text()) || null,
          // Only an explicit "Gratuito" label is a price; otherwise it stays unknown.
          priceCents: item.find('.curso_gratuito').length ? 0 : null,
          currency: item.find('.curso_gratuito').length ? 'EUR' : null,
          availability: null,
          isCancelled: false,
          isSoldOut: false,
          courseLanguage: null,
        };
        const existing = records.get(externalId);
        if (
          existing &&
          JSON.stringify(existing.record) !== JSON.stringify(record)
        )
          throw new Error(`Conflicting duplicate course ${externalId}`);
        records.set(externalId, { aula, record });
      });
  });
  return [...records.values()];
}

export function createAulaAbiertaAdapter(
  options: FetchOptions = {},
): SourceAdapter {
  return {
    async fetchRecords(source: SourceConfig) {
      const root = new URL(source.listingUrl);
      const aula = root.searchParams.get('aula');
      if (!aula || !/^\d+$/.test(aula))
        throw new Error('Aula Abierta source has no classroom code');
      const get = createSourceFetcher(root.origin, options);
      // The host had no robots.txt when approved. Any new policy requires a review.
      if ((await get(`${root.origin}/robots.txt`, true)) !== null)
        throw new Error(
          'robots.txt policy present or changed; review source configuration before ingestion',
        );
      const parsed = parseAulaAbiertaPage((await get(root.href))!, root.href);
      if (parsed.some((course) => course.aula !== aula))
        throw new Error('Listing contains another classroom');
      if (!parsed.length && !source.mayBeEmpty)
        throw new Error('No course records fetched');
      if (parsed.length > 1000)
        throw new Error('Aula Abierta record limit exceeded');
      return parsed.map(({ record }) => record);
    },
  };
}
