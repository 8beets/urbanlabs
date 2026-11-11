import { TtlMemo } from '../cache/ttl-memo';
import { earliestLocalDate } from '../time/dates';
import type { IngestionDatabase } from './ingestion-port';

// Institutions rarely change, so the zones are memoized; the date is computed per call.
const zones = new TtlMemo<string[]>(5 * 60 * 1000, 1);

/**
 * The date used to decide whether an edition has ended. It is derived from the time
 * zones of the institutions in the database, not from one hard-coded place, so adding
 * a centre in another zone needs no code change.
 */
export async function liveCutoffDate(
  db: IngestionDatabase,
  now: Date = new Date(),
): Promise<string> {
  const timeZones = await zones.get(db, 'institutions', async () => {
    const result = await db
      .prepare('SELECT DISTINCT timezone FROM institutions LIMIT 100')
      .all<{ timezone: string }>();
    return result.results.map((row) => row.timezone);
  });
  return earliestLocalDate(timeZones, now);
}

export function clearClockCache(db: D1Database): void {
  zones.clear(db);
}
