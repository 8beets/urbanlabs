import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

// Budgets for the static build (docs/adr/0008-static-site.md). Run after `astro build`.
// Workers Free allows 20,000 static asset files per version and 25 MiB per file
// (https://developers.cloudflare.com/workers/platform/limits/#static-assets).
const CLIENT = 'dist/client';
const MAX_FILES = 20_000;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
// The browser downloads the live index for every search; keep it small. If this
// fails, split the index by region before raising the budget.
const LIVE_INDEX = 'search/live.json';
const MAX_LIVE_INDEX_GZIP = 150 * 1024;

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

const all = files(CLIENT);
const largest = all
  .map((path) => ({ path, bytes: statSync(path).size }))
  .sort((a, b) => b.bytes - a.bytes)[0];
const liveIndexGzip = gzipSync(readFileSync(join(CLIENT, LIVE_INDEX))).length;
const report = {
  event: 'static_build_budget',
  files: all.length,
  maxFiles: MAX_FILES,
  largestFile: largest?.path,
  largestFileBytes: largest?.bytes ?? 0,
  liveIndexGzipBytes: liveIndexGzip,
  maxLiveIndexGzipBytes: MAX_LIVE_INDEX_GZIP,
};
console.info(JSON.stringify(report));
const failures = [
  all.length >= MAX_FILES && `${all.length} asset files (limit ${MAX_FILES})`,
  (largest?.bytes ?? 0) > MAX_FILE_BYTES &&
    `${largest?.path} is ${largest?.bytes} bytes (limit ${MAX_FILE_BYTES})`,
  liveIndexGzip > MAX_LIVE_INDEX_GZIP &&
    `${LIVE_INDEX} is ${liveIndexGzip} bytes gzipped (budget ${MAX_LIVE_INDEX_GZIP})`,
].filter(Boolean);
if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
}
