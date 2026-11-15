# ADR 0011: Fetch sources concurrently behind a single database writer

Status: accepted

## Context

ADR 0006 runs scheduled ingestion as sequential batches of eight sources, and each
batch handles its sources strictly one after another. On 2026-11-14 a full run took
28 minutes for nine batches. Each batch spent its time on two things: fetching (one
request per second per source, with a 10-second crawl delay on some hosts) and writing
to production D1, where every statement is a `wrangler d1 execute` call and each
snapshot is a file import. Each job also spent about 30 seconds on setup.

The rule that matters is that remote D1 imports never overlap: a file import briefly
makes the database unavailable. Fetching has no such limit; most sources live on
different hosts (each Miram centre has its own subdomain).

## Decision

- Within one ingest process, sources are fetched concurrently, at most six at a time
  (`src/lib/ingestion/concurrency.ts`).
- Every database call goes through one queue (`serializeDatabase`), in the order it
  was made, so there is still a single writer and imports never overlap. The batches
  of ADR 0006 stay sequential (`max-parallel: 1`), so no two processes write either.
- Per-host politeness is kept with lanes: sources of one platform share a host, its
  crawl delay and sometimes one downloaded snapshot (Madrid, Málaga, Sabadell), so
  they still run one at a time. Miram centres are separate subdomains on one
  provider and run up to three at a time, so that provider sees at most three
  requests per second.
- With shorter batches, the plan's default batch size goes from 8 to 16, halving the
  per-job setup overhead while staying well inside the 30-minute job limit.
- One failing source still fails only itself; outcomes are collected after all
  sources settle.

## Consequences

- A run should take a fraction of the previous time: about the slowest lane plus the
  serialized writes, instead of the sum of every fetch and write.
- Log lines from different sources interleave; each structured line names its source.
- Several `ingestion_runs` rows can be `running` at once within a batch.
- A new platform whose sources share a host gets a limit of one by default. Only
  Miram has a higher limit; raising another needs a reviewed change to
  `ingestionLane`.
