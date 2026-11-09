# Ingestion

Run `npm run source:verify` for a live extraction smoke check without persistence, or `npm run ingest:live` after local migrations to write local D1. Neither runs in ordinary CI. Do not repeatedly poll the provider: one manually triggered run is sufficient for this milestone.

These commands now process all 15 approved sources sequentially. To select a single source, use `npm run source:verify -- miram-can-baste` or `npm run ingest:live -- --source miram-can-baste` (also available: `miram-sant-andreu`, `miram-pati-llimona`, and `miram-golferichs`). The CLI continues to the next source if one fails and exits unsuccessfully after recording all failures. Can Basté excludes category code `14` because it includes concerts; excluded codes and record IDs are documented `exclusions` in the centre registry (`data/centres/`), not hardcoded adapter behavior.

The typed adapter contract lives in `src/lib/ingestion/types.ts`. Miram-specific HTML extraction is isolated from source configuration and SQL. Zod validates every record at the boundary. A new provider should implement the same explicit interface, not a dynamically loaded plugin framework.

## Bounds and failures

- Sequential requests, at least one second apart.
- Fifteen-second request timeout, three attempts for connection errors, HTTP 429, and HTTP 5xx.
- Exponential backoff and bounded `Retry-After`; delays beyond 60 seconds abort for a later run.
- Maximum 2 MB per page, 60 pages, and 1,000 records per snapshot.
- HTTPS only, no redirects, approved origin/path/group/centre/activity type only.
- A newly present robots policy, malformed page, missing stable ID, conflicting duplicate, empty listing, or exceeded limit fails the run.

All pages must succeed before persistence. A single D1 transaction writes the snapshot and successful status. Source failures and database write failures leave previous courses and verification timestamps intact. Interrupted attempts may remain `running`; automatic run recovery and overlapping-run coordination are deferred. Run only one local importer at a time.

Missing records are retained. There is no deletion or automatic staleness inference. A future stale policy needs explicit, successful complete-snapshot semantics and tests. Unseen retained records keep their earlier verification timestamp.

## Identity and provenance

- Edition ID: SHA-256 of source ID + newline + external activity ID.
- Initial course ID: SHA-256 of institution ID + newline + NFC, whitespace-normalized, Catalan-lowercased exact title.
- Existing external records keep their course relationship when the source title changes, preserving reviewed title overrides.
- Similar titles, levels, and courses from different sources are not automatically merged.
- Source records retain their external ID, official URL, normalized extracted payload, content hash, first/last seen, and last successfully verified UTC timestamps.

The stored payload is the extracted record, not the full original HTML. A complete source-page archive is deliberately not implemented. Hashes cover the extracted payload; description changes affect them only when they change an extracted fact such as explicit cancellation.

Local scheduled dates remain ISO dates, not UTC instants. Times are retained in original schedule text. Individual schedules have a separate schema but are not populated until source inconsistencies can be handled without guessing.

## Adapter acceptance

The Miram adapter records `isCancelled` from explicit Spanish/Catalan cancellation
markers in course titles or notices starting with “activitat/actividad/taller/curs/curso”
followed by a cancellation marker. Registration policies, full waitlists, a zero price,
and institution closure notices do not imply cancellation. Availability remains null.
The flag is updated with each successful observed record, including when its explicit
notice is removed. Missing records and unsuccessful runs retain the previous flag.
Cancelled editions are retained with their original identity, price, and official URL.
Pati Llimona's cancelled workshops are no longer excluded by source configuration;
the reviewed film-screening exclusion remains.

After migration `0007`, refresh sources through the normal live importer to classify
existing editions. Old extracted payloads did not retain description notices, so the
migration does not guess their cancellation state. Production refresh requires the
usual explicit approval.

Verify real source behavior; save a minimal provenance-labelled fixture; test parsing, validation, pagination, retries, identity, atomic persistence, repeat imports, failure recovery, and manual correction preservation. Keep deterministic tests separate from live verification. Document unknowns and unsupported variants rather than silently guessing.

## Authorized cloud refresh

After explicit approval for production updates and signing in with Wrangler:

```sh
npm run ingest:production -- --live
# Or one approved source:
npm run ingest:production -- --live --source miram-pati-llimona
```

Without `--live`, the command makes no requests. It uses the same adapter, validation, snapshot persistence, identities, and reviewed-correction handling as local ingestion. A minimal database port allows the Node-only Wrangler bridge to reuse the authoritative persistence code. This bridge is never imported by the Worker; authentication stays in Wrangler. It runs through the host Wrangler CLI without starting local workerd or mounting Cloudflare credentials into Docker.

Prepared values are serialized as escaped SQL literals for Wrangler's file-import transport and tested with real SQLite. Each snapshot uses D1's atomic file import; a failed import rolls back, though the database can be briefly unavailable during an import. The runner validates CLI JSON results, including file-import progress prefixes, and records a failed run without advancing previous verification timestamps when a source fetch fails. Run only one remote importer at a time.

### Scheduled refresh

`.github/workflows/ingest.yml` refreshes production daily at 04:17 UTC (GitHub Actions, not Workers Cron: scraping many sources would exceed Workers Free subrequest/CPU limits). It reuses the deploy secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

The run has two stages:

1. **Plan** (`npm run ingest:plan`) reads, never writes, the production run history (one indexed lookup per source in `loadSourceStatuses`) and chooses the sources that are due: never imported first, then the longest since their last _successful_ run, skipping any refreshed in the last 20 hours and taking at most 60 per run, so very large registries rotate over several days. It groups them into batches of eight. Ordering uses the last success, so a persistently failing source cannot hide behind its failed attempts and takes only one slot per run.
2. **Ingest** runs one matrix job per batch with `max-parallel: 1` (the remote importer must never run twice at once, and the workflow-level concurrency group makes later runs wait rather than cancel). `fail-fast` is off: a failing batch fails its job, so GitHub notifies the maintainers, but later batches still run, and a failed source keeps its previous data. Each source's own outcome is also recorded in `ingestion_runs`.

Manual runs (`workflow_dispatch`) accept a single `source` ID or `force` to refresh every approved source regardless of recency. Locally, `--source id` or `--sources id1,id2` selects sources for `ingest`, `ingest:production`, and `ingest:plan`. Scheduled workflows only run from the default branch and GitHub disables them after 60 days without repository activity.
Miram pagination is zero-indexed: the default page equals `p=0`, while `p=1` contains different records. The queue canonicalizes only `p=0`, retaining the 60-page bound. Explicitly labelled future previews without edition IDs are counted in `ingestion_previews_skipped` logs and omitted; unrecognized missing-ID markup still fails. A complete preview-only page is accepted, but an entirely empty source snapshot still fails. Exact single local dates and the explicit base price `Preu: Gratuït` are supported; malformed dates and conditional-free prose remain unknown.

The seven-source expansion was loaded from manually verified real snapshots through the same runner, avoiding repeated source requests during validation. Temporary snapshots remain outside the repository. Routine tests use minimal saved fixtures and isolated synthetic dates; they are never imported into browsing data.

## Freshness and drift

The weekly `Data freshness` workflow (`npm run freshness`, read-only) reports two things in one tracking issue labelled `data-freshness`:

- Sources with no successful import for more than 7 days (or never imported). This is how a changed layout, a source that stays down, or a persistently empty listing becomes visible without watching each daily run.
- Reviewed centre data (details, coordinates, registration) whose verification date is older than 180 days.

The issue is created or updated while something is stale and closed automatically once everything is fresh. The workflow never writes to D1 or the registry: re-verifying a centre means checking the official source and updating the date in `data/centres/`. Run `npm run freshness -- --offline` to check only the registry dates locally.

## Explicit source locations

Every centre record in `data/centres/` supplies `country` (ISO country code) and
`cityId` (a seeded city ID). All current approved sources explicitly use
`ES` and `barcelona`. Add reference locations through a new migration before using
a new city ID; registration enforces the country/city relationship atomically.
Do not infer geography from names, addresses, or source prose. Adding Tarragona to
the reference catalog creates no courses; only verified ingestion can populate it.
