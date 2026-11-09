import { selectedSources } from '../src/lib/ingestion/cli';
import { adapterFor } from '../src/lib/ingestion/adapters';
import { runIngestion } from '../src/lib/ingestion/run';
import { WranglerIngestionDatabase } from '../src/lib/db/wrangler-ingestion';

const args = process.argv.slice(2);
const selected = selectedSources(args);
if (!args.includes('--live')) {
  console.info(
    'No requests made. After approval and Wrangler sign-in, use npm run ingest:production -- --live [--source approved-source-id | --sources id1,id2] to update REMOTE D1.',
  );
} else {
  const db = new WranglerIngestionDatabase();
  let failed = false;
  for (const source of selected) {
    try {
      await runIngestion(db, adapterFor(source), source);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      failed = true;
    }
  }
  if (failed) process.exitCode = 1;
}
