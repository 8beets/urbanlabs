import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { getPlatformProxy } from 'wrangler';
import { exportSnapshot } from '../src/lib/catalog/export';
import { snapshotPath } from '../src/lib/catalog/snapshot-file';
import { WranglerIngestionDatabase } from '../src/lib/db/wrangler-ingestion';
import type { IngestionDatabase } from '../src/lib/db/ingestion-port';

// Writes the catalogue snapshot the static build reads (URBANLABS_SNAPSHOT or
// .cache/snapshot.json). Read-only: it never writes to any database.
//   --remote             production D1 through Wrangler (needs Cloudflare credentials)
//   --persist <path>     local D1 state directory (default: Wrangler's .wrangler/state)

const {
  values: { remote, persist },
} = parseArgs({
  options: { remote: { type: 'boolean' }, persist: { type: 'string' } },
});

async function withDatabase<T>(
  use: (db: IngestionDatabase) => Promise<T>,
): Promise<T> {
  if (remote) return use(new WranglerIngestionDatabase());
  const platform = await getPlatformProxy<Cloudflare.Env>({
    configPath: 'wrangler.jsonc',
    remoteBindings: false,
    ...(persist ? { persist: { path: persist } } : {}),
  });
  try {
    return await use(platform.env.DB);
  } finally {
    await platform.dispose();
  }
}

const snapshot = await withDatabase((db) => exportSnapshot(db));
const path = snapshotPath();
await mkdir(dirname(path), { recursive: true });
await writeFile(path, JSON.stringify(snapshot));
console.info(
  JSON.stringify({
    event: 'snapshot_exported',
    target: remote ? 'remote' : 'local',
    editions: snapshot.editions.length,
    centres: snapshot.centres.length,
    path,
  }),
);
