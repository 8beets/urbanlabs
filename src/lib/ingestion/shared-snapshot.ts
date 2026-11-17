import type { FetchOptions } from './http';

const ONE_HOUR = 60 * 60 * 1000;

/**
 * A per-process cache for adapters that download one whole dataset and share it among
 * their sources (Madrid's CSV, Málaga's yearly agenda, Sabadell's catalogue): the first
 * source starts the read and the others await the same promise. An entry lasts an hour
 * and is keyed (e.g. Málaga's year), so a new key or an old entry starts a fresh read.
 * A failed read is dropped at once, so the next source tries again instead of reusing
 * the failure. Injected fetchers (tests) never use the cache.
 */
export function createSnapshotCache<T>(maxAgeMs = ONE_HOUR) {
  let entry: { key: string; at: number; value: Promise<T> } | null = null;
  return (
    options: FetchOptions,
    read: () => Promise<T>,
    key = '',
    now: () => number = Date.now,
  ): Promise<T> => {
    if (options.fetch) return read();
    if (!entry || entry.key !== key || now() - entry.at > maxAgeMs) {
      const value = read();
      entry = { key, at: now(), value };
      value.catch(() => {
        if (entry?.value === value) entry = null;
      });
    }
    return entry.value;
  };
}
