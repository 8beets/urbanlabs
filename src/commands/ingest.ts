import { Command } from 'commander';
import { adapterFor } from '../lib/ingestion/adapters';
import { runIngestion } from '../lib/ingestion/run';
import { withDatabase } from './database';
import {
  selectedSources,
  withSourceOptions,
  type SourceSelection,
} from './options';

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
      // One failing source must not stop the others; its data is preserved.
      for (const source of selected) {
        try {
          await runIngestion(db, adapterFor(source), source);
        } catch (error) {
          console.error(error instanceof Error ? error.message : error);
          process.exitCode = 1;
        }
      }
    });
  },
);
