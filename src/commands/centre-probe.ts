import { Command } from 'commander';
import { formatISO } from 'date-fns';
import { createMiramAdapter } from '../lib/ingestion/adapters/miram';
import { createSourceFetcher } from '../lib/ingestion/http';
import { draftEntry, parseMiramRoot, probeOrigin } from '../lib/centres/probe';
import {
  miramListingUrl,
  toSourceConfig,
  type Centre,
} from '../lib/centres/schema';

export const centreProbeCommand = new Command('centre-probe')
  .description(
    'Read robots.txt and the public navigation of a Miram registration host, then print a draft registry entry. A person must still verify identity, address and coordinates.',
  )
  .argument('<url>', 'https registration URL')
  .option(
    '--full',
    'also crawl the course catalogue (bounded and rate limited, nothing is persisted)',
  )
  .action(async (target: string, { full }: { full?: boolean }) => {
    const origin = probeOrigin(target);
    const get = createSourceFetcher(origin);
    const today = formatISO(new Date(), { representation: 'date' });

    const robots = await get(`${origin}/robots.txt`, true);
    if (robots !== null) {
      console.error(
        `robots.txt is present on ${origin}. Stop and review it before any collection:\n${robots.slice(0, 1000)}`,
      );
      process.exitCode = 1;
      return;
    }
    console.error(`robots.txt: absent (HTTP 404) on ${origin}`);

    const searchUrl = `${origin}/MiramModular/buscador/buscador.jsp`;
    const probe = parseMiramRoot((await get(searchUrl))!, searchUrl);
    console.error(`Page title: ${probe.title}`);
    console.error(
      `Footer: ${probe.footerName ?? '?'} — ${probe.footerAddress ?? '?'}`,
    );
    console.error(
      `Centre codes seen: ${probe.centreCodes.join(', ') || 'none'}`,
    );
    for (const type of probe.activityTypes) {
      console.error(
        `Activity type ${type.type} "${type.label}": ${type.categories
          .map((c) => `${c.code}=${c.label}`)
          .join(', ')}`,
      );
    }
    if (probe.centreCodes.length !== 1) {
      console.error(
        'Could not identify exactly one centre code; fill registration.centreCode by hand.',
      );
    }

    const draft = draftEntry(origin, probe, today);
    console.log(JSON.stringify(draft, null, 2));
    if (!full) return;

    const registration = draft.registration as Extract<
      Centre['registration'],
      { platform: 'miram' }
    >;
    if (registration.centreCode <= 0 || registration.activityType === 'TODO')
      throw new Error(
        '--full needs a single centre code and an AC activity type',
      );
    const source = toSourceConfig({
      ...(draft as unknown as Centre),
      id: 'cc-probe',
      slug: 'probe',
      name: 'Probe',
      officialUrl: 'https://example.invalid/',
      address: 'Probe',
    });
    console.error(`Crawling ${miramListingUrl(registration)} …`);
    const records = await createMiramAdapter().fetchRecords(source);
    const byCategory = new Map<string, number>();
    for (const record of records)
      byCategory.set(
        record.category ?? '(none)',
        (byCategory.get(record.category ?? '(none)') ?? 0) + 1,
      );
    console.error(
      `${records.length} editions. Review these categories and titles for non-courses:`,
    );
    for (const [category, count] of byCategory)
      console.error(`  ${category}: ${count}`);
    console.error(
      `Unknown start dates: ${records.filter((r) => r.startDate === null).length}; unknown prices: ${records.filter((r) => r.priceCents === null).length}`,
    );
    for (const record of records.slice(0, 5))
      console.error(`  ${record.externalId} ${record.title}`);
  });
