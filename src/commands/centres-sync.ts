import { Command } from 'commander';
import { registerSource } from '../lib/db/ingestion';
import { sources } from '../lib/sources';
import { withDatabase } from './database';

export const centresSyncCommand = new Command('centres-sync')
  .description(
    'Update approved centre profiles in local D1 (apply migrations first), or production D1 with --remote',
  )
  .option('--remote', 'write to production D1')
  .action(async (options: { remote?: boolean }) => {
    await withDatabase(options, async (db) => {
      for (const source of sources) await registerSource(db, source);
    });
    console.info(
      `Updated ${sources.length} approved centre profiles in ${options.remote ? 'production' : 'local'} D1. Course records were not imported.`,
    );
  });
