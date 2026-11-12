import { appendFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { WranglerIngestionDatabase } from '../src/lib/db/wrangler-ingestion';
import { loadSourceStatuses } from '../src/lib/db/ingestion-status';
import { planIngestion } from '../src/lib/ingestion/plan';
import { sources } from '../src/lib/sources';
import { selectedSources, sourceOptions } from '../src/lib/ingestion/cli';

// Reads (never writes) the production run history to choose which sources to refresh.
const { values } = parseArgs({
  options: {
    ...sourceOptions,
    force: { type: 'boolean' },
    'batch-size': { type: 'string', default: '8' },
    'min-age-hours': { type: 'string', default: '20' },
    'max-sources': { type: 'string', default: '60' },
  },
});
const force = values.force ?? false;
const explicit = values.source !== undefined || values.sources !== undefined;
const batchSize = Number(values['batch-size']);

const wanted = selectedSources(values);
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
          minAgeHours: Number(values['min-age-hours']),
          maxSources: Number(values['max-sources']),
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
