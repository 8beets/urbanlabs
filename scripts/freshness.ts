import { appendFileSync, writeFileSync } from 'node:fs';
import { WranglerIngestionDatabase } from '../src/lib/db/wrangler-ingestion';
import { loadSourceStatuses } from '../src/lib/db/ingestion-status';
import { centres } from '../src/lib/centres/registry';
import {
  checkFreshness,
  renderFreshnessReport,
} from '../src/lib/centres/freshness';
import { sources } from '../src/lib/sources';

// Read-only. `--offline` checks only the reviewed dates in the registry (no D1 access).
const args = process.argv.slice(2);
const offline = args.includes('--offline');
const options = {
  now: new Date(),
  maxProfileAgeDays: 180,
  maxSourceAgeDays: 7,
};
const statuses = offline
  ? []
  : await loadSourceStatuses(
      new WranglerIngestionDatabase(),
      sources.map((source) => source.id),
    );
const markdown = renderFreshnessReport(
  checkFreshness(centres, statuses, options),
  options,
);
console.log(markdown ?? 'Everything is fresh.');
// The workflow turns this file into (or closes) a single tracking issue.
if (markdown !== null) writeFileSync('freshness-report.md', markdown);
if (process.env.GITHUB_OUTPUT)
  appendFileSync(process.env.GITHUB_OUTPUT, `stale=${markdown !== null}\n`);
