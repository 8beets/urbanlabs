import type {
  IngestionDatabase,
  IngestionStatement,
} from '../db/ingestion-port';
import type { SourceConfig } from './types';

// Sources are fetched concurrently, but the database sees one call at a time: a
// remote D1 file import must never overlap another write (ADR 0006, ADR 0011).

/** Runs calls one after another, in the order they were made, whatever their outcome. */
function createQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(call: () => Promise<T>): Promise<T> => {
    const result = tail.then(call);
    tail = result.catch(() => undefined);
    return result;
  };
}

class QueuedStatement implements IngestionStatement {
  constructor(
    readonly inner: IngestionStatement,
    private readonly queue: ReturnType<typeof createQueue>,
  ) {}
  bind(...values: (string | number | null)[]) {
    return new QueuedStatement(this.inner.bind(...values), this.queue);
  }
  run() {
    return this.queue(() => this.inner.run());
  }
  all<T>() {
    return this.queue(() => this.inner.all<T>());
  }
}

/** The same database, with every query and batch serialized through one queue. */
export function serializeDatabase(db: IngestionDatabase): IngestionDatabase {
  const queue = createQueue();
  return {
    prepare: (sql) => new QueuedStatement(db.prepare(sql), queue),
    batch: (statements) =>
      queue(() =>
        db.batch(
          statements.map((statement) => {
            if (!(statement instanceof QueuedStatement))
              throw new Error('Statement belongs to a different database');
            return statement.inner;
          }),
        ),
      ),
  };
}

export interface Lane {
  key: string;
  limit: number;
}

/**
 * How many sources of a kind may be fetched at once. Sources of one platform share a
 * host and its crawl delay (and some share one downloaded snapshot), so they stay one
 * at a time, as before. Miram centres each have their own subdomain on one provider,
 * so a few run together.
 */
export function ingestionLane(source: SourceConfig): Lane {
  return source.platform === 'miram'
    ? { key: 'miram', limit: 3 }
    : { key: source.platform, limit: 1 };
}

/**
 * Runs `task` for every item with at most `limit` running in total and at most each
 * lane's own limit per lane. Items start in order as slots free up. Resolves when all
 * have settled, with each outcome in item order; one failure never stops the others.
 */
export async function runBounded<T, R>(
  items: T[],
  limit: number,
  laneOf: (item: T) => Lane,
  task: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  if (!Number.isInteger(limit) || limit < 1)
    throw new Error('limit must be a positive integer');
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  const waiting = items.map((item, index) => ({
    item,
    index,
    lane: laneOf(item),
  }));
  for (const { lane } of waiting)
    if (!Number.isInteger(lane.limit) || lane.limit < 1)
      throw new Error(`Lane ${lane.key} needs a positive integer limit`);
  const active = new Map<string, number>();
  let running = 0;
  return new Promise((resolve) => {
    const startNext = () => {
      if (!waiting.length && !running) return resolve(results);
      for (let i = 0; i < waiting.length && running < limit;) {
        const { item, index, lane } = waiting[i]!;
        if ((active.get(lane.key) ?? 0) >= lane.limit) {
          i++;
          continue;
        }
        waiting.splice(i, 1);
        running++;
        active.set(lane.key, (active.get(lane.key) ?? 0) + 1);
        Promise.resolve()
          .then(() => task(item))
          .then(
            (value) => (results[index] = { status: 'fulfilled', value }),
            (reason: unknown) =>
              (results[index] = { status: 'rejected', reason }),
          )
          .finally(() => {
            running--;
            active.set(lane.key, active.get(lane.key)! - 1);
            startNext();
          });
      }
    };
    startNext();
  });
}
