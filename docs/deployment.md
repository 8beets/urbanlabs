# Deployment

## Public preview

URL: https://learnaprop.learnaprop.workers.dev/

First deployed with explicit user approval on 2026-11-06. Worker: `learnaprop`. Cloudflare environment: `production`. D1: `learnaprop` (`1b9916a8-60ff-4d90-8e10-94216c4e9723`), created in Western Europe. Initial Worker version: `cd1613a8-547f-4b5c-be35-c36a047d267c`.

The preview is public and retains `noindex`. It is not a production-readiness claim: custom domains, canonical URLs, sitemaps, comprehensive expired-edition handling, source reuse review, and scheduled refresh remain incomplete. No paid service, plan upgrade, or automatic deployment workflow was enabled.

## Explicit deployment commands

Sign in to the intended Cloudflare account with `npx wrangler login`, then inspect `npx wrangler whoami`. Credentials stay in Wrangler's user configuration, outside the repository. Account and database IDs in `wrangler.jsonc` are identifiers, not credentials.

After approval for any new remote schema/resource changes:

```sh
npm run db:migrate:production
npm run build:production
npx wrangler deploy --config dist/server/wrangler.json --dry-run
```

Review the generated configuration: Worker `learnaprop`, `workers_dev: true`, and `DB` pointing to the cloud database above. Then deploy the same artifact:

```sh
npx wrangler deploy --config dist/server/wrangler.json
```

For subsequent explicitly authorized deployments, `npm run deploy:production` builds and deploys. Astro's Cloudflare Vite adapter selects the production environment **at build time** via `CLOUDFLARE_ENV=production`; changing the environment only during deployment does not retarget a build. See [Cloudflare environments](https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments/).

The base environment remains local-only with `workers_dev: false` and a placeholder D1 ID. Local migration/type-generation scripts explicitly read `wrangler.jsonc`; the production binding is defined separately under `env.production`. Never point local test fixtures at the production database. Sessions and image transformation are disabled, so the build has only D1 and static asset bindings, without automatic KV or Images provisioning.

## Initial data import

The cloud database was empty before initialization. Docker stopped responding during the attempted local export, so a fresh snapshot was fetched from both approved sources with the existing bounded adapters. The authoritative ingestion runner wrote into temporary in-memory Node SQLite, and SQLite's `quote()` produced a data-only initialization export outside the repository. Wrangler imported that export into the already migrated remote D1 database. No fixture data or descriptions were published.

The initial import contains 22 Sant Andreu and 29 Can Basté editions, with 51 source records and new cloud first-seen/verification timestamps. It does not copy the earlier Docker first-seen history. Cloud D1 is the canonical store; the temporary SQLite database was only an initialization aid. The SQL import processed 159 statements and produced a database of approximately 0.20 MB. No test records or foreign-key violations were present after import.

The initial seed is not a refresh mechanism. Do not replay data-only `INSERT` exports into an existing production database: the production refresh command preserves identities and reviewed corrections through the normal ingestion rules (see below). `npm run ingest:live` continues to target **local** D1 only.

## Verification

The production-specific build, binding generation, TypeScript checks, lint, and 21 deterministic tests passed. The deployment dry run showed a 163.77 KiB gzip Worker package, with only `DB` and `ASSETS` bindings. Remote migration state and data integrity were checked directly against D1.

Read-only live checks passed for Spanish and Catalan homepages, combined centre/category filtering, search plus maximum price, pagination, HTTP 400 validation errors, and the built CSS asset. No tracking cookies were set. The earlier [Linux CI](https://github.com/8beets/urbanlabs/actions/runs/42078396499) and local Docker runs validated actual D1 behavior and desktop/mobile browser interactions; Docker was not available for a repeat browser run during this deployment.

## Free-plan constraints

Official limits reviewed 2026-11-05:

- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/): Free runtime request/CPU/subrequest constraints must be rechecked before scheduling ingestion.
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/): Free database size 500 MB, 5 GB total account storage, and 50 queries per Worker invocation. A batch counts as one invocation query; statement limits still apply.
- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/): Free includes 5 million rows read and 100,000 rows written daily. Index writes count toward usage.
- [Astro Cloudflare adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/): framework/runtime and provisioning behavior.

Only D1 and Workers are configured. Discovery returns at most 12 rows plus a next-page sentinel. Substring search and offset pagination suit the initial dataset; they do not guarantee cheap queries at larger scale. Monitor real query plans and row reads before expansion.

Ingestion runs as an explicit local or authorized remote CLI operation. A scheduled Worker or GitHub Actions importer needs separate workload measurements and approval for its remote resources and credentials. No claim is made that the entire ingestion workload fits Free-plan CPU limits.

## 2026-11-06 refresh and interface update

An authorized refresh using `npm run ingest:production -- --live` persisted 37 Sant Andreu, 99 Can Basté, and 56 Pati Llimona editions with the authoritative importer. The first Can Basté attempt hit the old 30-page bound, was recorded as failed, and retained previous records; a subsequent successful run used the documented 60-page bound. The final database has 192 editions with provenance. The remote command supports `--source` and requires explicit `--live`; `ingest:live` remains local-only.

The accompanying interface adds illustrative stock photos and the generated logo, fixes search-input width after choosing filters, and translates weekday labels for the Spanish interface while retaining original stored source text. Asset licenses and the logo prompt are documented in [assets](assets.md).

The category follow-up groups photography, dance, arts, and physical-activity categories through an explicit map, uses readable localized labels, and limits category pills to the chosen centre. This is a query/presentation change; no migration or source-data rewrite is needed. Original provider categories and legacy alias URLs remain supported. The full Docker suite passed 53 unit/SQLite tests, 1 D1 runtime test, and 12 desktop/mobile browser tests; the production build and deployment dry run passed.

## Golferichs and Casa del Rellotge

On 2026-11-06, `npm run ingest:production -- --live --source miram-golferichs` imported 113 actual Golferichs editions through the unchanged Miram adapter. Cloud D1 now has 305 editions and provenance records across four imported centres, zero `TEST` courses, and no foreign-key violations. No schema migration or paid infrastructure was introduced.

The interface adds a separate official-programme link for FAB Casa del Rellotge. Its `robots.txt` disallows general crawlers, so no course importer or D1 course records were added for that centre. See [source research](data-sources.md) for the policy and integration boundary.

The complete Docker suite passed 60 unit/SQLite tests, 1 actual D1 test, and 16 desktop/mobile browser tests, including Golferichs category normalization, centre filtering, source links, and Spanish/Catalan programme-link copy. The production build and deployment dry run passed with only the existing DB and ASSETS bindings.

## Eleven-centre directory update

The seven-source expansion added 195 Casa Elizalde, 27 Albareda, 50 El Sortidor, 133 Vil·la Urània, 42 Urgell, 14 FAB Casa del Rellotge, and 11 FAB Casa del Mig editions. Manually validated real snapshots went through the authoritative ingestion runner sequentially, preserving identity, provenance, and reviewed corrections. Cloud D1 now holds 777 source records/editions across 11 centres, with no `TEST` courses or foreign-key violations. No migration or additional cloud service was needed.

Casa Elizalde's blocked main-site API is unused; its separate public registration host is the source. The user-supplied FAB Miram roots replaced Casa del Rellotge's former link-only integration and keep the two FABs separate by source/institution and activity type. Source exclusions and unpublished-preview handling are documented in [source research](data-sources.md).

The production build and dry run passed with only DB/ASSETS bindings. Docker passed formatting, lint, binding generation, TypeScript, D1/migrations, build, and 18 desktop/mobile browser tests. The final deterministic suite passed 74 tests, including the strict single-date guard and a database regression for merging expression/creativity categories. Local Docker was populated with the same 777 real editions; local desktop/mobile checks verified image delivery and no horizontal overflow. The interface includes localized category labels, amber centre pills, green category pills, and the GitHub footer icon/link.

## Responsive filter sidebar — issue #3

The discovery controls moved into one native GET form in `CourseFilters.astro`, with a desktop sidebar and a keyboard-accessible mobile disclosure. Applied filters can be removed individually or cleared outside the disclosure. Combined query values, pagination resets, aliases, centre-specific categories, and locale switching are preserved. Extra parameters survive submissions for the future location-filter work in issue #2; geographic filtering is not implemented by this change.

Formatting, lint, TypeScript, 74 deterministic tests, D1 runtime checks, the production build/dry run, and 28 desktop/mobile browser cases were validated. The pagination cases were rerun successfully after updating their Next-link selector. Visual review confirmed the sidebar/collapsed mobile layout and no horizontal overflow. No source data, database schema, or infrastructure changed.

## Centre directory and embedded maps — issue #1

Migration `0003_institution_profiles.sql` adds centre profiles and backfills stable
slugs. Apply it before deploying this version, then run `npm run
centres:sync:production` to populate reviewed profiles for all 11 existing centres.
The metadata-only sync preserves the 777 course editions and source records; it
does not fetch course providers or create new course records. Profiles carry
municipal provenance and verification dates. No new cloud resource is required.

Both locales have directory and detail routes, header navigation and paginated
centre-specific courses. Maps are embedded through OpenStreetMap's standard iframe
with verified markers, attribution and a larger-map link. Missing coordinates have
an explicit fallback. Real embed rendering was checked in Chrome separately from
the deterministic suite. Docker validated formatting, lint, types, 79 deterministic
tests, 1 actual D1 runtime test, migrations, build, and 36 desktop/mobile browser
cases. An additional directory-pagination/outage regression passed after that run.

## Explicit locale URLs — issue #6

Spanish discovery and centre pages now live at `/es/`, `/es/centros` and
`/es/centros/[slug]`. Catalan keeps `/ca/` and `/ca/centres`. Navigation, filter
forms, pagination, course-category links and language switching all use explicit
locale prefixes. Existing unprefixed Spanish URLs return HTTP 308 redirects,
preserving query strings; browser checks also verify fragment preservation.

Docker checks passed formatting, lint, TypeScript, 80 unit/SQLite tests, 1 actual
D1 runtime test, the build and 40 desktop/mobile browser cases. The production
build and Wrangler deployment dry run passed. This release requires no database
migration or data refresh.

## Automatic deployment from GitHub

The `Checks and deployment` workflow runs formatting, lint, binding generation,
TypeScript, unit/SQLite tests, actual D1 tests, local migrations and the build for
pushes and pull requests. Playwright installation and browser tests are temporarily
skipped in GitHub Actions; run `npm run test:e2e` locally or the complete Docker
check suite for browser coverage. After the CI checks pass, a push to `main`
deploys the exact tested commit.
The deployment job rebuilds with `npm run build:production`, verifies the commit is
still the head of `main`, and runs `npm run db:migrate:production` before deploying
the generated `dist/server/wrangler.json`. The migration command targets the remote
production D1 binding in `wrangler.jsonc`; the build selects that same binding.
A failed migration stops the job before the Worker deployment. Migrations must be
compatible with the currently deployed Worker because they run before its replacement.
Pull requests and other branches run checks only.

Configure these repository Actions secrets in GitHub:

- `CLOUDFLARE_API_TOKEN`: a Cloudflare deployment token scoped to the target account,
  with D1 Edit permission for production migrations.
- `CLOUDFLARE_ACCOUNT_ID`: the account ID used by the production configuration.

Secrets are passed only to the migration and deployment steps. Production jobs are
serialized, and a job skips deployment if its commit is no longer the head of `main`.
An active deployment is allowed to finish before the next job starts. Both migration
and deployment steps use the current-commit guard. The workflow does not import
course data or synchronize centre metadata; those remain separate operations
requiring explicit approval. Worker and database names continue to come from
`wrangler.jsonc`.

See [Cloudflare GitHub Actions authentication](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
and [GitHub concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).

## Latest-course homepage — issue #11

Apply `0004_source_records_first_seen.sql` before this release with
`npm run db:migrate:production`. The migration only adds an index; there is no
production reimport or metadata rewrite. The homepage shows up to 20 newly added,
unexpired course editions. Search and filtering move to `/es/buscar` and `/ca/cerca`;
old homepage filter URLs redirect to preserve shared links. Existing public caching
also covers search, with complete query strings as keys. GitHub Actions continues
to deploy only after the configured checks pass, with Playwright run locally/Docker.

## Email alerts — issue #80

Alerts ship disabled. The production config sets only `EMAIL_PROVIDER=brevo`, so the
search link is hidden and `/es/alertas` answers 503 until all of these exist:

1. A sending domain (not `workers.dev`, and not a webmail address, which would fail
   DMARC) authenticated in Brevo with SPF, DKIM and DMARC records.
2. A Brevo API key, stored as Worker secret and repository secret `BREVO_API_KEY`.
3. A Turnstile widget for the production hostname. Put its site key in
   `env.production.vars.TURNSTILE_SITE_KEY`, and store the secret with
   `wrangler secret put TURNSTILE_SECRET_KEY --env production`.
4. A random secret of at least 32 characters (for example `openssl rand -base64 48`)
   as Worker secret and repository secret `ALERT_TOKEN_SECRET`. Use the same value in
   both places: digest links are signed in Actions and verified by the Worker.
   Rotating it invalidates every outstanding link.
5. `EMAIL_FROM` (for example `avisos@<domain>`) in `env.production.vars`, and the
   repository variables `EMAIL_FROM` and `SITE_URL` (the public https origin).
6. Migration `0011_course_alerts.sql`, which the deployment workflow applies.

The `Course alert digests` workflow is manual and defaults to a dry run, which reads
production D1 and reports counts without sending or writing. Once a manual run has
been checked, add a daily `schedule` to `.github/workflows/alerts.yml`. Each run
sends at most `ALERT_DAILY_LIMIT` (default 250) emails, below Brevo's free
300/day, leaving room for confirmations sent by the Worker.

Local development and E2E use the `log` adapter, Turnstile's documented always-pass
test keys and a throwaway token secret from the top-level `vars` in `wrangler.jsonc`.
Those values are not inherited by `env.production`.

## Static site — issue #89

Public pages are now prerendered from a production snapshot and served as Workers
static assets; only the alert pages and the 404 page run on the Worker
([ADR 0008](adr/0008-static-site.md)). The `Build and deploy` workflow
(`.github/workflows/deploy.yml`) runs, in order:

1. `npm run db:migrate:production`
2. `npm run snapshot:production` (read-only export of production D1 through Wrangler)
3. `npm run build:production`
4. `npm run check:build` (Free-plan static asset limits and a 150 KB gzipped budget
   for `/search/live.json`)
5. `wrangler deploy --config dist/server/wrangler.json`

It is called by CI for pushes to `main`, and also runs after every finished
`Scheduled ingestion` run and daily at 23:17 UTC (just after midnight in Madrid), as
approved in issue #89. A failure at any step deploys nothing, so the previous build
stays live. It needs the existing `CLOUDFLARE_API_TOKEN` (with D1 read/edit) and
`CLOUDFLARE_ACCOUNT_ID` secrets. `npm run deploy:production` runs the same steps
locally after explicit approval.

Whether static pages link to email alerts is decided at build time: they do when
`TURNSTILE_SITE_KEY` and the sender configuration (`EMAIL_PROVIDER=brevo` with
`EMAIL_FROM`) are in `env.production.vars`. After adding them, redeploy (or wait for
the next scheduled build) so the links appear.

Verified locally with `wrangler dev` on the build output: prerendered pages, the
search index and `_redirects` rules are served without invoking the Worker; the alert
pages and unknown URLs are. This has not yet been verified on the production account.
