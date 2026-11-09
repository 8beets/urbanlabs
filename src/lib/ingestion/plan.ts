export interface SourceStatus {
  id: string;
  /** Finish time of the latest successful run, or null if it has never succeeded. */
  lastSuccessAt: string | null;
}

export interface PlanOptions {
  now: Date;
  /** Sources refreshed more recently than this are left for a later run. */
  minAgeHours: number;
  /** Upper bound per run; the stalest sources go first, so the rest rotate in. */
  maxSources: number;
  batchSize: number;
}

export interface IngestionPlan {
  /** Source IDs grouped into batches, stalest first. */
  batches: string[][];
  planned: number;
  /** Fresh enough, or beyond the per-run cap. */
  deferred: number;
}

function positiveInteger(value: number, name: string) {
  if (!Number.isInteger(value) || value < 1)
    throw new Error(`${name} must be a positive integer`);
}

/**
 * Chooses which approved sources to refresh now. Never-imported sources come first
 * (in registry order), then the longest-unrefreshed. Ordering uses the last
 * *successful* run, so a failing source cannot hide behind its own failed attempts,
 * and it only ever takes one slot per run.
 */
export function planIngestion(
  statuses: SourceStatus[],
  options: PlanOptions,
): IngestionPlan {
  positiveInteger(options.maxSources, 'maxSources');
  positiveInteger(options.batchSize, 'batchSize');
  if (!Number.isFinite(options.minAgeHours) || options.minAgeHours < 0)
    throw new Error('minAgeHours must be zero or more');
  const cutoff = options.now.getTime() - options.minAgeHours * 3_600_000;
  const due = statuses
    .map((status, order) => ({
      ...status,
      order,
      time:
        status.lastSuccessAt === null
          ? Number.NEGATIVE_INFINITY
          : Date.parse(status.lastSuccessAt),
    }))
    .filter((status) => {
      if (Number.isNaN(status.time))
        throw new Error(`Invalid last success time for ${status.id}`);
      return status.time <= cutoff;
    })
    .sort((a, b) => (a.time === b.time ? a.order - b.order : a.time - b.time));
  const selected = due.slice(0, options.maxSources).map(({ id }) => id);
  const batches: string[][] = [];
  for (let start = 0; start < selected.length; start += options.batchSize)
    batches.push(selected.slice(start, start + options.batchSize));
  return {
    batches,
    planned: selected.length,
    deferred: statuses.length - selected.length,
  };
}
