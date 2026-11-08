import { createMiramAdapter } from '../src/lib/ingestion/adapters/miram';
import { createSourceFetcher } from '../src/lib/ingestion/http';
import {
  draftEntry,
  parseMiramRoot,
  probeOrigin,
} from '../src/lib/centres/probe';
import { miramListingUrl, type Centre } from '../src/lib/centres/schema';
import { toSourceConfig } from '../src/lib/centres/schema';

const usage =
  'Usage: npm run centre:probe -- <https registration URL> [--full]\n' +
  'Reads robots.txt and the public navigation of a Miram registration host, then prints a\n' +
  'draft registry entry. --full also crawls the course catalogue (bounded and rate limited,\n' +
  'nothing is persisted). A person must still verify identity, address and coordinates.';
const args = process.argv.slice(2);
const target = args.find((arg) => !arg.startsWith('--'));
if (!target || args.some((a) => a.startsWith('--') && a !== '--full')) {
  console.error(usage);
  process.exit(2);
}

const origin = probeOrigin(target);
const get = createSourceFetcher(origin);
const today = new Date().toISOString().slice(0, 10);

const robots = await get(`${origin}/robots.txt`, true);
if (robots !== null) {
  console.error(
    `robots.txt is present on ${origin}. Stop and review it before any collection:\n${robots.slice(0, 1000)}`,
  );
  process.exit(1);
}
console.error(`robots.txt: absent (HTTP 404) on ${origin}`);

const probe = parseMiramRoot(
  (await get(`${origin}/MiramModular/buscador/buscador.jsp`))!,
  `${origin}/MiramModular/buscador/buscador.jsp`,
);
console.error(`Page title: ${probe.title}`);
console.error(
  `Footer: ${probe.footerName ?? '?'} — ${probe.footerAddress ?? '?'}`,
);
console.error(`Centre codes seen: ${probe.centreCodes.join(', ') || 'none'}`);
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

if (args.includes('--full')) {
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
}
