import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Command } from 'commander';
import { exportSnapshot } from '../lib/catalog/export';
import { snapshotPath } from '../lib/catalog/snapshot-file';
import { withDatabase, type DatabaseOptions } from './database';

// Read-only: it never writes to any database.
export const snapshotCommand = new Command('snapshot')
  .description(
    'Write the catalogue snapshot the static build reads (URBANLABS_SNAPSHOT or .cache/snapshot.json)',
  )
  .option('--remote', 'read production D1 (needs Cloudflare credentials)')
  .option('--persist <path>', 'local D1 state directory')
  .action(async (options: DatabaseOptions) => {
    const snapshot = await withDatabase(options, (db) => exportSnapshot(db));
    const path = snapshotPath();
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(snapshot));
    console.info(
      JSON.stringify({
        event: 'snapshot_exported',
        target: options.remote ? 'remote' : 'local',
        editions: snapshot.editions.length,
        centres: snapshot.centres.length,
        path,
      }),
    );
  });
