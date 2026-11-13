import { appendFileSync } from 'node:fs';
import { Command } from 'commander';
import { WranglerIngestionDatabase } from '../lib/db/wrangler-ingestion';
import { loadSourceStatuses } from '../lib/db/ingestion-status';
import { planIngestion } from '../lib/ingestion/plan';
import { sources } from '../lib/sources';
import {
  integer,
  isExplicit,
  selectedSources,
  withSourceOptions,
  type SourceSelection,
} from './options';

// Reads (never writes) the production run history to choose which sources to refresh.
export const ingestPlanCommand = withSourceOptions(
  new Command('ingest-plan')
    .description('Print the batches of sources to refresh, as JSON')
    .option('--force', 'refresh every selected source regardless of recency')
    .option('--batch-size <n>', 'sources per batch', integer, 8)
    .option(
      '--min-age-hours <n>',
      'skip sources refreshed more recently',
      integer,
      20,
    )
    // Defaults to every approved source, so the cap grows with the registry.
    .option('--max-sources <n>', 'sources per run', integer),
).action(
  async (
    options: SourceSelection & {
      force?: boolean;
      batchSize: number;
      minAgeHours: number;
      maxSources?: number;
    },
  ) => {
    const wanted = selectedSources(options);
    const plan =
      isExplicit(options) || options.force
        ? // Explicit requests and forced refreshes ignore recency and the per-run cap.
          planIngestion(
            wanted.map((source) => ({ id: source.id, lastSuccessAt: null })),
            {
              now: new Date(),
              minAgeHours: 0,
              maxSources: Math.max(wanted.length, 1),
              batchSize: options.batchSize,
            },
          )
        : planIngestion(
            await loadSourceStatuses(
              new WranglerIngestionDatabase(),
              sources.map((source) => source.id),
            ),
            {
              now: new Date(),
              minAgeHours: options.minAgeHours,
              maxSources: options.maxSources ?? sources.length,
              batchSize: options.batchSize,
            },
          );

    console.error(
      `Planned ${plan.planned} of ${sources.length} sources in ${plan.batches.length} batch(es); ${plan.deferred} deferred.`,
    );
    const batches = JSON.stringify(
      plan.batches.map((batch) => batch.join(',')),
    );
    console.log(batches);
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `Ingestion plan: ${plan.planned} source(s) in ${plan.batches.length} batch(es), ${plan.deferred} deferred.\n\n${plan.batches.map((batch) => `- ${batch.join(', ')}`).join('\n')}\n`,
      );
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(process.env.GITHUB_OUTPUT, `batches=${batches}\n`);
  },
);
