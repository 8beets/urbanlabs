import { appendFileSync, writeFileSync } from 'node:fs';
import { Command } from 'commander';
import { WranglerIngestionDatabase } from '../lib/db/wrangler-ingestion';
import {
  loadSourceCategories,
  loadSourceStatuses,
} from '../lib/db/ingestion-status';
import { centres } from '../lib/centres/registry';
import {
  checkFreshness,
  renderFreshnessReport,
} from '../lib/centres/freshness';
import { sources } from '../lib/sources';

// Read-only.
export const freshnessCommand = new Command('freshness')
  .description('Report stale centre profiles and sources')
  .option(
    '--offline',
    'check only the reviewed dates in the registry (no D1 access)',
  )
  .action(async ({ offline = false }: { offline?: boolean }) => {
    const options = {
      now: new Date(),
      maxProfileAgeDays: 180,
      maxSourceAgeDays: 7,
    };
    const db = offline ? null : new WranglerIngestionDatabase();
    const statuses = db
      ? await loadSourceStatuses(
          db,
          sources.map((source) => source.id),
        )
      : [];
    const categories = db ? await loadSourceCategories(db) : [];
    const markdown = renderFreshnessReport(
      checkFreshness(centres, statuses, options, categories),
      options,
    );
    console.log(markdown ?? 'Everything is fresh.');
    // The workflow turns this file into (or closes) a single tracking issue.
    if (markdown !== null) writeFileSync('freshness-report.md', markdown);
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(process.env.GITHUB_OUTPUT, `stale=${markdown !== null}\n`);
  });
