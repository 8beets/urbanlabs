import { getPlatformProxy } from 'wrangler';
import { WranglerIngestionDatabase } from '../lib/db/wrangler-ingestion';
import type { IngestionDatabase } from '../lib/db/ingestion-port';

export interface DatabaseOptions {
  /** Production D1 through Wrangler (needs Cloudflare credentials). */
  remote?: boolean;
  /** Local D1 state directory (default: Wrangler's .wrangler/state/v3). */
  persist?: string;
}

/** Runs `use` against production D1 (`--remote`) or local D1, disposing the local proxy. */
export async function withDatabase<T>(
  { remote, persist = '.wrangler/state/v3' }: DatabaseOptions,
  use: (db: IngestionDatabase) => Promise<T>,
): Promise<T> {
  if (remote) return use(new WranglerIngestionDatabase());
  const platform = await getPlatformProxy<Cloudflare.Env>({
    configPath: 'wrangler.jsonc',
    persist: { path: persist },
    remoteBindings: false,
  });
  try {
    return await use(platform.env.DB);
  } finally {
    await platform.dispose();
  }
}
