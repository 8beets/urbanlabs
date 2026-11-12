import { parseArgs } from 'node:util';
import { getPlatformProxy } from 'wrangler';
import { adapterFor } from '../src/lib/ingestion/adapters';
import { selectedSources, sourceOptions } from '../src/lib/ingestion/cli';
import { runIngestion } from '../src/lib/ingestion/run';

const { values } = parseArgs({
  options: { ...sourceOptions, live: { type: 'boolean' } },
});
const selected = selectedSources(values);
if (!values.live) {
  console.info(
    'No network requests made. To fetch the approved public source into LOCAL D1, run npm run ingest:live. Apply npm run db:migrate first.',
  );
} else {
  const platform = await getPlatformProxy<Cloudflare.Env>({
    configPath: 'wrangler.jsonc',
    persist: { path: '.wrangler/state/v3' },
    remoteBindings: false,
  });
  try {
    let failed = false;
    for (const source of selected) {
      try {
        await runIngestion(platform.env.DB, adapterFor(source), source);
      } catch {
        failed = true;
      }
    }
    if (failed) process.exitCode = 1;
  } finally {
    await platform.dispose();
  }
}
