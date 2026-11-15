import { describe, expect, it } from 'vitest';
import {
  ingestionLane,
  runBounded,
  serializeDatabase,
} from '../../src/lib/ingestion/concurrency';
import type {
  IngestionDatabase,
  IngestionStatement,
} from '../../src/lib/db/ingestion-port';
import { sources } from '../../src/lib/sources';

const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

/** A fake database that records overlapping calls and the order they ran in. */
function recordingDatabase() {
  let inFlight = 0;
  let maxInFlight = 0;
  const calls: string[] = [];
  const track = async (label: string, fail = false) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await tick();
    calls.push(label);
    inFlight--;
    if (fail) throw new Error(`failed ${label}`);
    return { results: [label] };
  };
  class FakeStatement implements IngestionStatement {
    constructor(readonly sql: string) {}
    bind() {
      return this;
    }
    run() {
      return track(this.sql, this.sql === 'FAIL');
    }
    all<T>() {
      return track(this.sql) as Promise<{ results: T[] }>;
    }
  }
  const db: IngestionDatabase & { batched: unknown[][] } = {
    batched: [],
    prepare: (sql) => new FakeStatement(sql),
    batch: (statements) => {
      db.batched.push(statements);
      return track(`batch:${statements.length}`);
    },
  };
  return { db, calls, maxInFlight: () => maxInFlight };
}

describe('serialized ingestion database', () => {
  it('never runs two calls at once and keeps their order', async () => {
    const { db, calls, maxInFlight } = recordingDatabase();
    const queued = serializeDatabase(db);
    await Promise.all([
      queued.prepare('a').run(),
      queued.prepare('b').bind('x').all(),
      queued.batch([queued.prepare('c'), queued.prepare('d')]),
      queued.prepare('e').run(),
    ]);
    expect(maxInFlight()).toBe(1);
    expect(calls).toEqual(['a', 'b', 'batch:2', 'e']);
  });

  it('passes the underlying statements to batch and rejects foreign ones', async () => {
    const { db } = recordingDatabase();
    const queued = serializeDatabase(db);
    await queued.batch([queued.prepare('c')]);
    expect(db.batched[0]![0]).toHaveProperty('sql', 'c');
    await expect(queued.batch([db.prepare('raw')])).rejects.toThrow(
      'different database',
    );
  });

  it('keeps going after a failed call', async () => {
    const { db, calls } = recordingDatabase();
    const queued = serializeDatabase(db);
    const failed = queued.prepare('FAIL').run();
    const next = queued.prepare('after').run();
    await expect(failed).rejects.toThrow('failed FAIL');
    await expect(next).resolves.toEqual({ results: ['after'] });
    expect(calls).toEqual(['FAIL', 'after']);
  });
});

describe('bounded source runs', () => {
  async function run(
    items: { id: string; lane: string; limit: number; fail?: boolean }[],
    limit: number,
  ) {
    let running = 0;
    let maxRunning = 0;
    const perLane = new Map<string, number>();
    const maxPerLane = new Map<string, number>();
    const started: string[] = [];
    const outcomes = await runBounded(
      items,
      limit,
      (item) => ({ key: item.lane, limit: item.limit }),
      async (item) => {
        started.push(item.id);
        running++;
        maxRunning = Math.max(maxRunning, running);
        perLane.set(item.lane, (perLane.get(item.lane) ?? 0) + 1);
        maxPerLane.set(
          item.lane,
          Math.max(maxPerLane.get(item.lane) ?? 0, perLane.get(item.lane)!),
        );
        await tick();
        running--;
        perLane.set(item.lane, perLane.get(item.lane)! - 1);
        if (item.fail) throw new Error(`failed ${item.id}`);
        return item.id;
      },
    );
    return { outcomes, maxRunning, maxPerLane, started };
  }

  it('respects the overall limit and each lane limit, and runs everything', async () => {
    const items = [
      ...['m1', 'm2', 'm3', 'm4', 'm5'].map((id) => ({
        id,
        lane: 'miram',
        limit: 3,
      })),
      ...['z1', 'z2', 'z3'].map((id) => ({ id, lane: 'zaragoza', limit: 1 })),
      { id: 'g1', lane: 'girona', limit: 1 },
    ];
    const { outcomes, maxRunning, maxPerLane, started } = await run(items, 4);
    expect(maxRunning).toBe(4);
    expect(maxPerLane.get('miram')).toBe(3);
    expect(maxPerLane.get('zaragoza')).toBe(1);
    expect(started.slice(0, 4)).toEqual(['m1', 'm2', 'm3', 'z1']);
    expect(outcomes.map((o) => o.status === 'fulfilled' && o.value)).toEqual(
      items.map((item) => item.id),
    );
  });

  it('reports failures in item order without stopping the others', async () => {
    const { outcomes } = await run(
      [
        { id: 'a', lane: 'x', limit: 1, fail: true },
        { id: 'b', lane: 'x', limit: 1 },
      ],
      2,
    );
    expect(outcomes[0]).toMatchObject({ status: 'rejected' });
    expect(outcomes[1]).toEqual({ status: 'fulfilled', value: 'b' });
  });

  it('settles at once with nothing to do and rejects invalid limits', async () => {
    expect(await run([], 3)).toMatchObject({ outcomes: [] });
    await expect(run([{ id: 'a', lane: 'x', limit: 1 }], 0)).rejects.toThrow(
      'positive integer',
    );
    await expect(run([{ id: 'a', lane: 'x', limit: 0 }], 2)).rejects.toThrow(
      'Lane x',
    );
  });

  it('keeps every non-Miram platform to one source at a time', () => {
    for (const source of sources)
      expect(ingestionLane(source)).toEqual(
        source.platform === 'miram'
          ? { key: 'miram', limit: 3 }
          : { key: source.platform, limit: 1 },
      );
  });
});
