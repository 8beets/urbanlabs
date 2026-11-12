import { earliestLocalDate } from '../time/dates';
import type { IngestionDatabase } from './ingestion-port';

/**
 * The date used to decide whether an edition has ended. It is derived from the time
 * zones of the institutions in the database, not from one hard-coded place, so adding
 * a centre in another zone needs no code change.
 */
export async function liveCutoffDate(
  db: IngestionDatabase,
  now: Date = new Date(),
): Promise<string> {
  const result = await db
    .prepare('SELECT DISTINCT timezone FROM institutions LIMIT 100')
    .all<{ timezone: string }>();
  return earliestLocalDate(
    result.results.map((row) => row.timezone),
    now,
  );
}
