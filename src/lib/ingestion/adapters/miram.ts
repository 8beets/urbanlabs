import { load } from 'cheerio';
import {
  cleanText,
  parseDateRange,
  parseEuroPrice,
} from '../normalization/values';
import { courseRecordSchema } from '../validation/record';
import { hasCancellationNotice } from '../normalization/cancellation';
import { hasSoldOutNotice } from '../normalization/availability';
import { createSourceFetcher, type FetchOptions } from '../http';
import type { CourseRecord, SourceAdapter, SourceConfig } from '../types';

// Footers of full cards seen live. Cotxeres Borrell prefixes the notice with a counter
// and a date ("0 20/07/2026 Places exhaurides…").
const fullNotice =
  /^(?:(?:\d+ \d{2}\/\d{2}\/\d{4} )?Places exhaurides\b|En aquests moments no queden places online per aquesta activitat\.$)/iu;

// Advance-preview footers seen live on cards without an identifier (Vil·la Urània, Sant Martí, Can Basté).
const previewNotice =
  /^(?:Podreu realitzar les inscripcions (?:en línia|on-line) a partir del|Les inscripcions on-line les podreu fer a partir del) \d{2}\/\d{2}\/\d{4}$/u;

const fold = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function parseMiramPage(
  html: string,
  pageUrl: string,
  allowEmpty = false,
  venues?: string[],
): {
  records: CourseRecord[];
  links: string[];
  unpublishedPreviews: number;
  fullWithoutId: number;
  otherVenues: number;
} {
  const $ = load(html);
  if (!$('#eFamilia').length)
    throw new Error('Miram listing structure changed or access page returned');
  const category =
    cleanText($('h4').first().text())
      .match(/\((.+)\)$/u)?.[1]
      ?.trim() ?? null;
  const records: CourseRecord[] = [];
  let unpublishedPreviews = 0;
  let fullWithoutId = 0;
  let otherVenues = 0;
  $('.card.overh').each((_, element) => {
    const card = $(element);
    // Single-session cards have no session accordion; their registration form still
    // carries the same stable activity identifier.
    const externalId =
      card.find('[id^="accordion"]').attr('id')?.replace('accordion', '') ??
      card.find('input[name="activitat"]').attr('value');
    if (
      !externalId &&
      previewNotice.test(cleanText(card.find('.card-footer').text()))
    ) {
      // Miram's advance previews expose no edition ID or dates. Do not invent one.
      unpublishedPreviews++;
      return;
    }
    if (
      !externalId &&
      fullNotice.test(cleanText(card.find('.card-footer').text()))
    ) {
      // Full single-session cards drop both the session accordion and the registration
      // form, so they expose no identifier (and usually no dates). Do not invent one.
      fullWithoutId++;
      return;
    }
    if (!externalId)
      throw new Error('Course card has no stable activity identifier');
    const paragraphs = card
      .find('.card-body')
      .first()
      .children('p.card-text')
      .map((_, p) => cleanText($(p).text()))
      .get();
    // A shared host lists several centres' cards; keep only this centre's venues.
    const venue = fold(paragraphs.find((p) => /^Espai:/u.test(p)) ?? '');
    if (venues && !venues.some((v) => venue.includes(fold(v)))) {
      otherVenues++;
      return;
    }
    const range = paragraphs.find((p) => /^(?:Del )?\d{1,2}\s+d[e’']/u.test(p));
    const [startDate, endDate] = parseDateRange(range ?? '');
    const priceCents = parseEuroPrice(
      paragraphs.find((p) => /^Preu:/u.test(p)) ?? '',
    );
    const title = cleanText(card.find('h5.card-header').first().text());
    const notices = card
      .find('.card-body p, .card-footer')
      .map((_, el) => cleanText($(el).text()))
      .get();
    records.push(
      courseRecordSchema.parse({
        externalId,
        title,
        officialUrl: `${pageUrl}#accordion${externalId}`,
        category,
        startDate,
        endDate,
        scheduleText: paragraphs[0] || null,
        priceCents,
        currency: priceCents === null ? null : 'EUR',
        availability: null,
        isCancelled: hasCancellationNotice(title, notices),
        isSoldOut: hasSoldOutNotice(notices),
        courseLanguage: null,
      }),
    );
  });
  const links = $('a.card[href], .pagination a[href], a[rel="next"][href]')
    .map((_, a) => new URL($(a).attr('href')!, pageUrl).href)
    .get();
  // Miram also renders numbered anchors without a pagination class or rel attribute.
  const current = new URL(pageUrl);
  $('a[href]').each((_, anchor) => {
    const href = $(anchor).attr('href')!;
    if (!href.includes('?')) return; // In-page session tabs inherit the current page query.
    const target = new URL(href, current);
    target.hash = '';
    if (target.searchParams.has('p') && approvedPage(target.href, current))
      links.push(target.href);
  });
  if (
    !allowEmpty &&
    !records.length &&
    !links.length &&
    !unpublishedPreviews &&
    !fullWithoutId &&
    !otherVenues
  )
    throw new Error('Empty Miram listing; manual review required');
  return {
    records,
    links: [...new Set(links)],
    unpublishedPreviews,
    fullWithoutId,
    otherVenues,
  };
}

function canonicalPage(value: string): string {
  const url = new URL(value);
  // Miram is zero-indexed: the default page equals p=0; p=1 is the next page.
  if (url.searchParams.get('p') === '0') url.searchParams.delete('p');
  url.hash = '';
  return url.href;
}

function approvedPage(url: string, root: URL): boolean {
  const candidate = new URL(url);
  return (
    candidate.origin === root.origin &&
    candidate.pathname === root.pathname &&
    ['g', 'c', 't'].every(
      (key) => candidate.searchParams.get(key) === root.searchParams.get(key),
    ) &&
    [...candidate.searchParams.keys()].every((key) =>
      ['g', 'c', 't', 'f', 'p'].includes(key),
    )
  );
}

export function createMiramAdapter(options: FetchOptions = {}): SourceAdapter {
  return {
    async fetchRecords(source: SourceConfig) {
      const root = new URL(source.listingUrl);
      const get = createSourceFetcher(root.origin, options);
      // The first approved host had no robots.txt. Any new policy requires a review.
      if ((await get(`${root.origin}/robots.txt`, true)) !== null)
        throw new Error(
          'robots.txt policy present or changed; review source configuration before ingestion',
        );
      const queue = [root.href];
      const visited = new Set<string>();
      const records = new Map<string, CourseRecord>();
      while (queue.length) {
        const url = canonicalPage(queue.shift()!);
        if (visited.has(url)) continue;
        if (!approvedPage(url, root)) throw new Error('Unapproved source page');
        // Cotxeres-Casinet lists ~400 cards four per page (~100 pages) for two centres.
        if (visited.size >= 120)
          throw new Error('Miram pagination exceeded 120-page limit');
        visited.add(url);
        const page = parseMiramPage(
          (await get(url))!,
          url,
          source.mayBeEmpty,
          source.venues,
        );
        if (page.unpublishedPreviews)
          console.info(
            JSON.stringify({
              event: 'ingestion_previews_skipped',
              source: source.id,
              page: url,
              count: page.unpublishedPreviews,
            }),
          );
        if (page.fullWithoutId)
          console.info(
            JSON.stringify({
              event: 'ingestion_full_without_id_skipped',
              source: source.id,
              page: url,
              count: page.fullWithoutId,
            }),
          );
        for (const record of page.records) {
          if (source.excludedExternalIds?.includes(record.externalId)) continue;
          const existing = records.get(record.externalId);
          if (
            existing &&
            (existing.title !== record.title ||
              existing.startDate !== record.startDate ||
              existing.isCancelled !== record.isCancelled ||
              existing.isSoldOut !== record.isSoldOut ||
              existing.priceCents !== record.priceCents)
          )
            throw new Error(
              `Conflicting duplicate activity ${record.externalId}`,
            );
          records.set(record.externalId, existing ?? record);
        }
        for (const rawLink of page.links) {
          const link = canonicalPage(rawLink);
          if (
            source.excludedCategoryCodes?.includes(
              new URL(link).searchParams.get('f') ?? '',
            )
          )
            continue;
          if (!approvedPage(link, root))
            throw new Error('Listing links outside approved source scope');
          if (!visited.has(link) && !queue.includes(link)) queue.push(link);
        }
        if (records.size > 1000) throw new Error('Miram record limit exceeded');
      }
      if (!records.size && !source.mayBeEmpty)
        throw new Error('No course records fetched');
      return [...records.values()];
    },
  };
}
