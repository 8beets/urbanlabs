import type { IngestionDatabase } from './ingestion-port';
import type { SourceStatus } from '../ingestion/plan';

/**
 * Last successful run per approved source. One indexed lookup per source (the
 * runs_source_started index), so the cost follows the number of sources, not the
 * growing run history. Sources never registered in the database have no row and are
 * reported as never imported.
 */
export async function loadSourceStatuses(
  db: IngestionDatabase,
  sourceIds: string[],
): Promise<SourceStatus[]> {
  const result = await db
    .prepare(
      `SELECT s.id AS id,
      (SELECT r.finished_at FROM ingestion_runs r
        WHERE r.source_id = s.id AND r.status = 'succeeded'
        ORDER BY r.started_at DESC LIMIT 1) AS last_success_at
    FROM sources s ORDER BY s.id LIMIT 1000`,
    )
    .all<{ id: string; last_success_at: string | null }>();
  const known = new Map(
    result.results.map((row) => [row.id, row.last_success_at]),
  );
  return sourceIds.map((id) => ({ id, lastSuccessAt: known.get(id) ?? null }));
}
