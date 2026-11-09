import { getPlatformProxy } from 'wrangler';
import { createMiramAdapter } from '../src/lib/ingestion/adapters/miram';
import { selectedSources } from '../src/lib/ingestion/cli';
import { runIngestion } from '../src/lib/ingestion/run';

const args = process.argv.slice(2);
const selected = selectedSources(args);
if (!args.includes('--live')) {
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
        await runIngestion(platform.env.DB, createMiramAdapter(), source);
      } catch {
        failed = true;
      }
    }
    if (failed) process.exitCode = 1;
  } finally {
    await platform.dispose();
  }
}
