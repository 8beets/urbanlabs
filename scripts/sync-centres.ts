import { parseArgs } from 'node:util';
import { getPlatformProxy } from 'wrangler';
import { registerSource } from '../src/lib/db/ingestion';
import { WranglerIngestionDatabase } from '../src/lib/db/wrangler-ingestion';
import { sources } from '../src/lib/sources';

// Only --remote is accepted; omit it for local D1. Apply migrations first.
const { values } = parseArgs({ options: { remote: { type: 'boolean' } } });
if (values.remote) {
  const db = new WranglerIngestionDatabase();
  for (const source of sources) await registerSource(db, source);
  console.info(
    `Updated ${sources.length} approved centre profiles in production D1. Course records were not imported.`,
  );
} else {
  const platform = await getPlatformProxy<Cloudflare.Env>({
    configPath: 'wrangler.jsonc',
    persist: { path: '.wrangler/state/v3' },
    remoteBindings: false,
  });
  try {
    for (const source of sources) await registerSource(platform.env.DB, source);
    console.info(
      `Updated ${sources.length} approved centre profiles in local D1. Course records were not imported.`,
    );
  } finally {
    await platform.dispose();
  }
}
