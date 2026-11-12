import { load } from 'cheerio';
import { cleanText } from '../ingestion/normalization/values';
import { MIRAM_HOST_SUFFIXES } from './schema';

export interface ProbedCategory {
  code: string;
  label: string;
}
export interface ProbedActivityType {
  type: string;
  label: string;
  categories: ProbedCategory[];
}
export interface MiramProbe {
  title: string;
  footerName: string | null;
  footerAddress: string | null;
  centreCodes: number[];
  activityTypes: ProbedActivityType[];
}

/** Accepts only https registration origins on approved Miram hosts. */
export function probeOrigin(input: string): string {
  const url = URL.parse(input);
  if (!url) throw new Error('Not a URL');
  if (
    url.protocol !== 'https:' ||
    url.port ||
    url.username ||
    url.password ||
    !MIRAM_HOST_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix))
  )
    throw new Error(
      `Only https registration hosts ending in ${MIRAM_HOST_SUFFIXES.join(' or ')} can be probed`,
    );
  return url.origin;
}

/** Reads the public navigation and footer of a Miram registration page. No guessing. */
export function parseMiramRoot(html: string, pageUrl: string): MiramProbe {
  const $ = load(html);
  const types = new Map<string, ProbedActivityType>();
  const codes = new Set<number>();
  $('li.nav-item').each((_, item) => {
    const entry = $(item);
    const label = cleanText(entry.children('a').first().text());
    entry.find('a[href*="buscador.jsp"]').each((_, anchor) => {
      const href = $(anchor).attr('href');
      if (!href) return;
      const target = new URL(href, pageUrl);
      if (target.origin !== new URL(pageUrl).origin) return;
      const centre = Number(target.searchParams.get('c'));
      const type = target.searchParams.get('t');
      if (!Number.isInteger(centre) || centre <= 0 || !type) return;
      codes.add(centre);
      const known = types.get(type) ?? { type, label, categories: [] };
      const code = target.searchParams.get('f');
      if (code && !known.categories.some((c) => c.code === code))
        known.categories.push({
          code,
          label: cleanText($(anchor).text()),
        });
      types.set(type, known);
    });
  });
  const name = $('b')
    .filter((_, element) =>
      /^CENT(RE|RO)\b/i.test(cleanText($(element).text())),
    )
    // The footer lists a type label first and the full centre name last.
    .last();
  const addressParagraph = name.closest('p').next('p');
  const lines = addressParagraph
    .html()
    ?.split(/<br\s*\/?>/i)
    .map((line) => cleanText(load(line).text()))
    .filter(Boolean);
  // Footer contact lines (phone, email) are deliberately not reported.
  const address = lines?.length
    ? lines.filter(
        (line) => !/^[+\d][\d ]{7,}$/.test(line) && !line.includes('@'),
      )
    : [];
  return {
    title: cleanText($('title').text()),
    footerName: name.length ? cleanText(name.text()) : null,
    footerAddress: address.length ? address.join(', ') : null,
    centreCodes: [...codes],
    activityTypes: [...types.values()],
  };
}

/**
 * A registry entry for a person to complete. Fields that only a human can verify
 * hold "TODO" markers, which the registry schema rejects, so an unfinished draft
 * cannot be committed by accident.
 */
export function draftEntry(
  origin: string,
  probe: MiramProbe,
  today: string,
): Record<string, unknown> {
  const centreCode = probe.centreCodes.length === 1 ? probe.centreCodes[0] : 0;
  const course = probe.activityTypes.find((t) => t.type === 'AC');
  return {
    id: 'TODO: stable institution id, e.g. cc-<name>',
    slug: 'TODO: url slug',
    name: `TODO: official name (footer says: ${probe.footerName ?? 'unknown'})`,
    officialUrl: 'TODO: official website or municipal page, https',
    address: `TODO: confirm (footer says: ${probe.footerAddress ?? 'unknown'})`,
    country: 'TODO: ISO 3166-1 alpha-2',
    city: 'TODO',
    cityId: 'TODO: seeded city id',
    timezone: 'TODO: IANA time zone, e.g. Europe/Madrid',
    // Every profile field needs a person; none is prefilled with a value that could validate.
    profile: {
      phone: 'TODO: from the official directory',
      detailsSourceUrl: 'TODO: official directory entry, https',
      detailsVerifiedAt: 'TODO: date you checked it (YYYY-MM-DD)',
      location:
        'TODO: replace with {latitude, longitude, sourceUrl, verifiedAt} from the official directory, or delete if unverified',
    },
    registration: {
      platform: 'miram',
      origin,
      centreCode,
      activityType: course ? 'AC' : 'TODO',
      verifiedAt: today,
      robotsTxt: 'absent',
    },
  };
}
