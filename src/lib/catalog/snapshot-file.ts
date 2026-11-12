import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { snapshotSchema, type Snapshot } from './types';

// Build-time only (prerendering runs in Node). The Worker never reads the snapshot.

export const DEFAULT_SNAPSHOT_PATH = '.cache/snapshot.json';

export function snapshotPath(): string {
  return resolve(process.env.URBANLABS_SNAPSHOT || DEFAULT_SNAPSHOT_PATH);
}

let cached: { path: string; modified: number; snapshot: Snapshot } | undefined;

/**
 * Reads and validates the snapshot once per build (and again in `astro dev` after a
 * new export); a missing file fails the build.
 */
export function loadSnapshot(): Snapshot {
  const path = snapshotPath();
  let text: string;
  let modified: number;
  try {
    modified = statSync(path).mtimeMs;
    if (cached?.path === path && cached.modified === modified)
      return cached.snapshot;
    text = readFileSync(path, 'utf8');
  } catch (error) {
    throw new Error(
      `No catalogue snapshot at ${path}. Run \`npm run snapshot\` (local D1) or \`npm run snapshot:production\` first.`,
      { cause: error },
    );
  }
  const snapshot = snapshotSchema.parse(JSON.parse(text));
  cached = { path, modified, snapshot };
  return snapshot;
}

/** The moment the pages of this build describe: when the snapshot was taken. */
export function buildDate(snapshot: Snapshot): Date {
  return new Date(snapshot.generatedAt);
}
