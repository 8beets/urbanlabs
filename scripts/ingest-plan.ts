import { appendFileSync } from 'node:fs';
import { WranglerIngestionDatabase } from '../src/lib/db/wrangler-ingestion';
import { loadSourceStatuses } from '../src/lib/db/ingestion-status';
import { planIngestion } from '../src/lib/ingestion/plan';
import { sources } from '../src/lib/sources';
import { selectedSources } from '../src/lib/ingestion/cli';

// Reads (never writes) the production run history to choose which sources to refresh.
const args = process.argv.slice(2);
function option(name: string, fallback: number): number {
  const index = args.indexOf(name);
  return index === -1 ? fallback : Number(args[index + 1]);
}
const force = args.includes('--force');
const explicit = args.includes('--source') || args.includes('--sources');
const batchSize = option('--batch-size', 8);

const wanted = selectedSources(args);
const plan =
  explicit || force
    ? // Explicit requests and forced refreshes ignore recency and the per-run cap.
      planIngestion(
        wanted.map((source) => ({ id: source.id, lastSuccessAt: null })),
        {
          now: new Date(),
          minAgeHours: 0,
          maxSources: Math.max(wanted.length, 1),
          batchSize,
        },
      )
    : planIngestion(
        await loadSourceStatuses(
          new WranglerIngestionDatabase(),
          sources.map((source) => source.id),
        ),
        {
          now: new Date(),
          minAgeHours: option('--min-age-hours', 20),
          maxSources: option('--max-sources', 60),
          batchSize,
        },
      );

console.error(
  `Planned ${plan.planned} of ${sources.length} sources in ${plan.batches.length} batch(es); ${plan.deferred} deferred.`,
);
const batches = JSON.stringify(plan.batches.map((batch) => batch.join(',')));
console.log(batches);
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `Ingestion plan: ${plan.planned} source(s) in ${plan.batches.length} batch(es), ${plan.deferred} deferred.\n\n${plan.batches.map((batch) => `- ${batch.join(', ')}`).join('\n')}\n`,
  );
if (process.env.GITHUB_OUTPUT)
  appendFileSync(process.env.GITHUB_OUTPUT, `batches=${batches}\n`);
