import { Command } from 'commander';
import { adapterFor } from '../lib/ingestion/adapters';
import { runIngestion } from '../lib/ingestion/run';
import {
  ingestionLane,
  runBounded,
  serializeDatabase,
} from '../lib/ingestion/concurrency';
import { withDatabase } from './database';
import {
  selectedSources,
  withSourceOptions,
  type SourceSelection,
} from './options';

// Sources fetched at once in one process; see ingestionLane for the per-platform limits.
const MAX_CONCURRENT_SOURCES = 6;

export const ingestCommand = withSourceOptions(
  new Command('ingest')
    .description(
      'Fetch approved sources into local D1, or production D1 with --remote',
    )
    .option('--live', 'make network requests (without it nothing is fetched)')
    .option(
      '--remote',
      'write to production D1 (needs approval and Wrangler sign-in)',
    ),
).action(
  async (options: SourceSelection & { live?: boolean; remote?: boolean }) => {
    const selected = selectedSources(options);
    if (!options.live) {
      console.info(
        options.remote
          ? 'No requests made. After approval and Wrangler sign-in, add --live to update REMOTE D1.'
          : 'No network requests made. Add --live (npm run ingest:live) to fetch into LOCAL D1; apply npm run db:migrate first.',
      );
      return;
    }
    await withDatabase(options, async (db) => {
      // Sources are fetched concurrently within their lanes, but every database call
      // goes through one queue, so writes never overlap (ADR 0011). One failing
      // source must not stop the others; its data is preserved.
      const queued = serializeDatabase(db);
      const outcomes = await runBounded(
        selected,
        MAX_CONCURRENT_SOURCES,
        ingestionLane,
        (source) => runIngestion(queued, adapterFor(source), source),
      );
      for (const outcome of outcomes)
        if (outcome.status === 'rejected') {
          const error: unknown = outcome.reason;
          console.error(error instanceof Error ? error.message : error);
          process.exitCode = 1;
        }
    });
  },
);
