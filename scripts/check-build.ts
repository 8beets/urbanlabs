import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

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
const largestIndex = liveIndexes.sort((a, b) => b.gzip - a.gzip)[0]!;
const report = {
  event: 'static_build_budget',
  files: all.length,
  maxFiles: MAX_FILES,
  largestFile: largest?.path,
  largestFileBytes: largest?.bytes ?? 0,
  liveIndexes: liveIndexes.length,
  largestLiveIndex: largestIndex.path,
  largestLiveIndexGzipBytes: largestIndex.gzip,
  maxLiveIndexGzipBytes: MAX_LIVE_INDEX_GZIP,
};
console.info(JSON.stringify(report));
const failures = [
  all.length >= MAX_FILES && `${all.length} asset files (limit ${MAX_FILES})`,
  (largest?.bytes ?? 0) > MAX_FILE_BYTES &&
    `${largest?.path} is ${largest?.bytes} bytes (limit ${MAX_FILE_BYTES})`,
  ...liveIndexes
    .filter((index) => index.gzip > MAX_LIVE_INDEX_GZIP)
    .map(
      (index) =>
        `${index.path} is ${index.gzip} bytes gzipped (budget ${MAX_LIVE_INDEX_GZIP})`,
    ),
].filter(Boolean);
if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
}
