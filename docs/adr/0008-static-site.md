# ADR 0008: Static site from a catalogue snapshot; only alerts run on the Worker

Status: accepted (issue #89)

## Context

Every public page was rendered by the Worker per request and read D1, with the
experimental Astro route cache in front (`docs/caching.md`). That kept D1 reads and
Worker requests proportional to traffic, needed per-isolate memoization (ADR 0005)
and tied page freshness to a five-minute cache. The catalogue only changes when
ingestion runs, a few times a day, so almost all of that request-time work recomputed
the same answers.

Workers static assets are served without invoking the Worker and do not count
towards the Free plan's daily request limit.

## Decision

- **Snapshot, then build.** `scripts/export-snapshot.ts` reads production D1 once
  per build with bounded, keyset-paginated `SELECT`s (`src/lib/catalog/export.ts`)
  and writes a validated JSON snapshot. Astro prerenders every public page from it
  (`output: 'static'`, `prerenderEnvironment: 'node'`). `wrangler d1 export` is not
  used: it cannot export databases with virtual tables (`courses_fts`).
- **One discovery implementation.** The former SQL listing, category, centre and
  latest-course queries became pure functions over the snapshot
  (`src/lib/catalog/query.ts`, `discovery.ts`). They run at build time and, over the
  search index, in the browser. Title search mirrors the FTS5 `unicode61
remove_diacritics 2` prefix query (`title-match.ts`). The integration tests that
  used to cover the SQL now run the same assertions through export + pure code.
- **Search in the browser.** The build emits `/search/live.json` (live editions,
  card fields only) and `/search/archive.json` (ended editions, loaded only for
  `archive=1`). The search page is a static shell with the unfiltered results
  prerendered; a small script reads the URL, filters, paginates and renders cards
  with the same markup function the build uses (`src/lib/courses/card.ts`). The GET
  form, shareable URLs and dependent options work as before, without `/api/filters`.
  CI fails the build if the gzipped live index exceeds 150 KB; the first remedy is to
  split it by region.
- **Alerts stay on demand.** The alert pages (`/es/alertas*`, `/ca/alertes*`) and
  the 404 page set `prerender = false` and run on the Worker with D1, Turnstile and
  Brevo, unchanged (ADR 0007). Whether static pages link to alerts is decided at
  build time from public configuration (`alertsAdvertised`); the alert pages still
  check the full configuration, secrets included, per request.
- **Static routing.** `public/_redirects` holds the legacy redirects; `public/_headers`
  makes browsers revalidate HTML and the search index. Pages use
  `build.format: 'preserve'` so URLs keep their current shape (`/es/buscar`,
  `/es/centros/sant-andreu`). Centre and category pages paginate in the path
  (`/es/centros/sant-andreu/2`).
- **Automatic deploys.** `.github/workflows/deploy.yml` migrates, snapshots, builds,
  checks budgets and deploys on push to `main`, after every finished ingestion run,
  and daily just after midnight in Madrid. A failed snapshot or build deploys
  nothing, so the previous version stays live.

## Decisions taken with the maintainer

1. Alerts are kept, so the site is static except for the alert pages.
2. Search requires JavaScript. Without it, the search page explains this and links to
   the static centre and category pages, which list every live edition.
3. Pages may be up to about a day old (rebuilt after each ingestion and daily).
   Prerendered cards carry their end date, and a small script hides editions that
   ended since the build.
4. Legacy query strings are not kept: old homepage filter URLs show the homepage,
   old `?page=` links show the first page, and the directory filter is client-side
   only. The search page keeps its filters in the URL so searches stay shareable.
5. Production deploys without a human step on the triggers above.
6. The change ships as one cutover; the site had no real traffic yet.

## Consequences

- Browsing never invokes the Worker or reads D1. Verified locally with `wrangler dev`:
  static pages, the search index and the redirects produce no Worker invocations; the
  alert pages and unknown URLs (404) do.
- D1 reads move from per-request to per-build (one snapshot: a few thousand rows).
  ADR 0005's per-isolate memoization now only serves the alert pages.
- Invalid search filters show an accessible error instead of an HTTP 400, and stale
  geographic selections are dropped in the browser (`history.replaceState`) instead of
  with a 302. Database outages no longer produce 503 pages: the build fails instead.
- The whole catalogue of live editions is downloaded for a search. That is bounded by
  the index budget, not by the database; past editions only load for the archive.
- Data and code deploy together, so a data refresh also redeploys the current `main`.
