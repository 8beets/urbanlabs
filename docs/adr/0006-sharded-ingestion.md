# ADR 0006: Plan and shard scheduled ingestion

Status: accepted

## Context

The daily job ran every approved source one after another in a single 30-minute
Actions job. With tens or hundreds of centres that exceeds the job limit, and one
failure cost the rest of the run. Remote imports cannot overlap (a D1 file import makes
the database briefly unavailable, and `docs/ingestion.md` forbids two importers).

## Decision

- A read-only plan stage picks due sources from `ingestion_runs`: never imported first,
  then least recently _successful_, skipping fresh ones and capping the run. A source
  that keeps failing takes one slot per run rather than starving the others.
- The ingest stage is a matrix of batches with `max-parallel: 1` and `fail-fast: false`.
  Batches stay sequential, so the single-importer rule holds, but each batch has its own
  time budget and runner and a failure only fails its batch.
- The plan is deterministic and pure (`src/lib/ingestion/plan.ts`) so it is unit tested;
  only the status query touches the database.
- Per-host politeness is unchanged: each source already waits between requests, and
  sources never run concurrently. Failure state stays in `ingestion_runs`; no new table.

## Consequences

- Adding centres needs no workflow change. Beyond the per-run cap, sources are
  refreshed every few days instead of daily; raise `--max-sources` if limits allow.
- `ingestion_runs` grows by one row per source per run; the status lookup is indexed
  per source, but old rows may eventually need pruning.
- Real parallelism would need a different import path, not just more matrix jobs.
