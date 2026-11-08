# ADR 0005: Keep D1 reads and writes proportional to live data

Status: accepted

## Context

Production reported 79% of the daily D1 Free read limit. Public pages did not scan
by liveness: every uncached listing, category and centre query walked all editions ever
imported, and each search URL repeated facet queries that do not depend on the query.
Ingestion also rewrote every row on every run, which would approach the 100,000
daily row-write limit with hundreds of centres.

## Decision

- Index liveness with a virtual generated column (`live_until`) so discovery queries
  are bounded by live editions, not history. Expired editions stay stored.
- Guard every ingestion upsert with `DO UPDATE ... WHERE <values differ>`; keep one
  unavoidable write per unchanged record for provenance timestamps.
- Memoize reference lookups per isolate for five minutes with a small shared utility,
  matching the page-cache window, instead of adding KV or other infrastructure.
- Decide "has this edition ended" from the time zones of the institutions in the
  database (earliest current local date, via date-fns and `@date-fns/tz`), not from a
  hard-coded zone.
- Measure query plans and timings on a synthetic database before choosing indexes.

## Consequences

- Reads follow live data; the listing still sorts the live set per uncached request,
  so very large live sets will eventually need keyset pagination or a materialised
  listing.
- A new Worker isolate or a change within five minutes can show slightly old filter
  options, as the page cache already can.
- Generated columns require SQLite 3.31+; the D1 runtime test in CI covers this.
