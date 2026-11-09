import { registerSource, saveSnapshot } from '../db/ingestion';
import { courseRecordSchema } from './validation/record';
import type { SourceAdapter, SourceConfig } from './types';
import type { IngestionDatabase } from '../db/ingestion-port';

export async function runIngestion(
  db: IngestionDatabase,
  adapter: SourceAdapter,
  source: SourceConfig,
): Promise<{ count: number; runId: string }> {
  await registerSource(db, source);
  const runId = crypto.randomUUID();
  await db
    .prepare(
      'INSERT INTO ingestion_runs (id, source_id, started_at, status) VALUES (?, ?, ?, ?)',
    )
    .bind(runId, source.id, new Date().toISOString(), 'running')
    .run();
  try {
    const records = (await adapter.fetchRecords(source)).map((record) =>
      courseRecordSchema.parse(record),
    );
    if ((!records.length && !source.mayBeEmpty) || records.length > 1000)
      throw new Error('Snapshot outside 1–1000 record bound');
    if (
      new Set(records.map((record) => record.externalId)).size !==
      records.length
    )
      throw new Error('Duplicate source identifiers');
    await saveSnapshot(db, source, records, runId, new Date().toISOString());
    console.info(
      JSON.stringify({
        event: 'ingestion_succeeded',
        source: source.id,
        runId,
        count: records.length,
      }),
    );
    return { count: records.length, runId };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.slice(0, 1000)
        : 'Unknown ingestion failure';
    await db
      .prepare(
        "UPDATE ingestion_runs SET status='failed', finished_at=?, error=? WHERE id=?",
      )
      .bind(new Date().toISOString(), message, runId)
      .run();
    console.error(
      JSON.stringify({
        event: 'ingestion_failed',
        source: source.id,
        runId,
        error: message,
      }),
    );
    throw error;
  }
}
