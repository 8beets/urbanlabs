import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { Command } from 'commander';

// Budgets for the static build (docs/adr/0008-static-site.md). Run after `astro build`.
// Workers Free allows 20,000 static asset files per version and 25 MiB per file
// (https://developers.cloudflare.com/workers/platform/limits/#static-assets).
const CLIENT = 'dist/client';
const MAX_FILES = 20_000;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
// The browser downloads its city's live index for every search; keep each one small
// (docs/adr/0010-city-sections.md). If one fails, look at that city's index size
// (or split the city) before raising the budget.
const SEARCH_DIR = 'search';
const MAX_LIVE_INDEX_GZIP = 150 * 1024;
// Leaflet is the largest script (~43 KB). The search script once reached ~80 KB by
// bundling the whole centre registry and zod; a script over this budget usually
// imports server-only code.
const MAX_SCRIPT_GZIP = 50 * 1024;

export const checkBuildCommand = new Command('check-build')
  .description('Check the static build against the Workers Free asset budgets')
  .action(() => {
    const all = readdirSync(CLIENT, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name));
    const largest = all
      .map((path) => ({ path, bytes: statSync(path).size }))
      .sort((a, b) => b.bytes - a.bytes)[0];
    const liveIndexes = readdirSync(join(CLIENT, SEARCH_DIR)).map((city) => {
      const path = join(SEARCH_DIR, city, 'live.json');
      return { path, gzip: gzipSync(readFileSync(join(CLIENT, path))).length };
    });
    if (!liveIndexes.length) throw new Error('No city search index was built');
    const scripts = all
      .filter((path) => path.endsWith('.js'))
      .map((path) => ({ path, gzip: gzipSync(readFileSync(path)).length }))
      .sort((a, b) => b.gzip - a.gzip);
    const largestIndex = liveIndexes.sort((a, b) => b.gzip - a.gzip)[0]!;
    console.info(
      JSON.stringify({
        event: 'static_build_budget',
        files: all.length,
        maxFiles: MAX_FILES,
        largestFile: largest?.path,
        largestFileBytes: largest?.bytes ?? 0,
        liveIndexes: liveIndexes.length,
        largestLiveIndex: largestIndex.path,
        largestLiveIndexGzipBytes: largestIndex.gzip,
        maxLiveIndexGzipBytes: MAX_LIVE_INDEX_GZIP,
        largestScript: scripts[0]?.path,
        largestScriptGzipBytes: scripts[0]?.gzip ?? 0,
        maxScriptGzipBytes: MAX_SCRIPT_GZIP,
      }),
    );
    const failures = [
      all.length >= MAX_FILES &&
        `${all.length} asset files (limit ${MAX_FILES})`,
      (largest?.bytes ?? 0) > MAX_FILE_BYTES &&
        `${largest?.path} is ${largest?.bytes} bytes (limit ${MAX_FILE_BYTES})`,
      ...liveIndexes
        .filter((index) => index.gzip > MAX_LIVE_INDEX_GZIP)
        .map(
          (index) =>
            `${index.path} is ${index.gzip} bytes gzipped (budget ${MAX_LIVE_INDEX_GZIP})`,
        ),
      ...scripts
        .filter((script) => script.gzip > MAX_SCRIPT_GZIP)
        .map(
          (script) =>
            `${script.path} is ${script.gzip} bytes gzipped (budget ${MAX_SCRIPT_GZIP})`,
        ),
    ].filter(Boolean);
    for (const failure of failures) console.error(failure);
    if (failures.length) process.exitCode = 1;
  });
