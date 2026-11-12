# Database

Canonical storage is Cloudflare D1. `migrations/0001_initial.sql` defines institutions, sources, reusable courses, course editions, individual schedules, source records, and ingestion runs with foreign keys and indexes.

`0002_course_categories.sql` adds an index for category navigation. The original applied migration remains unchanged. Centre filtering uses the existing institution index.

Use `npm run db:migrate` to apply migrations to **local** D1. The configured all-zero database ID is a deliberate local-only placeholder, not an existing remote resource. Local import and Astro development both use `.wrangler/state/v3`.

Use a new numbered migration for every subsequent schema change. Applied migrations are immutable. Queries use bound parameters. D1 `batch()` supplies atomic rollback; do not issue unsupported interactive SQL transactions through the D1 binding.

`courses.reviewed_title` is a maintainer override: imports update source titles without changing it. Public queries prefer the reviewed value. Other correction types and a review interface are not implemented.

`npm test` checks the migration and repository SQL against real Node SQLite with a small D1-method contract harness. It verifies constraints, idempotency, rollback, provenance, overrides, query behavior, and failed ingestion recovery. It does not prove the D1 runtime. Run `npm run test:d1` on a supported host for the separate actual D1 test.

The approved cloud preview uses the `production` environment's D1 database `learnaprop`, created in Western Europe. Both migrations were applied on 2026-11-06, followed by an initial import of 51 verified course editions and their provenance. No destructive production command is part of setup or CI. Local development retains its all-zero placeholder binding; production commands must explicitly select the production environment.

`0003_institution_profiles.sql` adds stable, unique centre slugs and optional contact,
original-language description, closure notice, and verified map coordinates. It
backfills slugs for existing institutions without changing courses or provenance.
Coordinates require both latitude/longitude and a source URL and verification date;
incomplete locations are rejected by database constraints. New source registrations
upsert reviewed profiles from the `profile` of each record in `data/centres/`. Missing optional
metadata preserves existing values; an explicit `notice: null` clears a reviewed notice.

After applying migrations, use `npm run centres:sync` to populate approved local
centre profiles without fetching or reimporting courses. With Docker, use
`docker compose exec app npm run centres:sync`. For an explicitly approved
production update, use `npm run db:migrate:production` followed by
`npm run centres:sync:production`. These commands update centre metadata only and
preserve existing course data and provenance. New source imports also register
profiles automatically.

`0004_source_records_first_seen.sql` indexes the homepage's first-seen ordering.
It does not change source timestamps, records or course identities. Latest additions
are bounded to 20 non-expired editions; ordinary searches retain their own filters
and pagination. Apply this additive migration before deploying the homepage split.

`0005_geographic_locations.sql` introduces countries, regions, cities and explicit
institution locations, with foreign keys and lookup indexes. It seeds ES → Catalunya
→ Barcelona/Tarragona and backfills only the 11 reviewed Barcelona institution IDs.
Unrecognized institutions remain unassigned rather than being inferred from address
text. Apply this additive migration before deploying geographic discovery; no course,
reviewed correction, or source provenance is changed. Future source registration
atomically upserts its explicit country/city assignment with the institution and
source; an unknown city or mismatched country fails the whole registration.

To add another region, create a new numbered migration inserting its region and city
rows, then configure each verified source's `institution.cityId` and country. The
existing `institutions.city` text remains a display label, not a filter identity.

`0006_alicante.sql` adds ES → Comunitat Valenciana → Alicante as reference
locations. The interface displays Comunidad Valenciana/Alicante in Spanish and
Comunitat Valenciana/Alacant in Catalan. No institutions or courses are assigned;
these filters show an empty state until verified sources are imported. Apply this
additive migration before deploying the updated location labels.

`0012_zaragoza.sql` adds ES → Aragón → Zaragoza as reference locations, labelled
Aragón/Zaragoza in Spanish and Aragó/Saragossa in Catalan. Centres are assigned when
their reviewed sources are first ingested. Apply it before ingesting Zaragoza sources.

`0007_cancelled_editions.sql` adds the constrained `course_editions.is_cancelled`
flag. It records an explicit source cancellation separately from availability. Zero
means no cancellation has been recorded, not that the course is available. Existing
rows start at zero and need a successful source refresh to detect notices that were
not previously extracted. Apply the migration before deploying or running ingestion.
Failed imports preserve the flag and verification timestamps with the prior snapshot.

`0010_sold_out_editions.sql` adds the constrained `course_editions.is_sold_out` flag, set only when the source prints its explicit "Places exhaurides" notice. Zero means no such notice, not confirmed availability. Existing rows start at zero until the next source refresh; run the migration before deploying or ingesting.

`0008_course_title_search.sql` adds the FTS5 table `courses_fts` (course id and the displayed title: reviewed title first) plus triggers that keep it current. The `unicode61 remove_diacritics 2` tokenizer makes title search case- and accent-insensitive.

`0009_edition_liveness_index.sql` adds the virtual generated column
`course_editions.live_until` (`coalesce(end_date, '9999-12-31')`) and indexes it.
Discovery lists only editions that have not ended (an unknown end date still counts as
not ended), and `end_date IS NULL OR end_date >= ?` cannot use an index, so listing,
category and centre queries used to walk every edition ever imported. They now start
from a range scan on `live_until`, so their cost follows live editions rather than
history. On a synthetic database with 30,000 expired and 1,500 live editions the
listing query went from about 65 ms to 3.5 ms and the category and centre queries from
about 74 and 44 ms to 2.4 and 1.6 ms. Expired editions stay stored for provenance. The
homepage's latest-additions query keeps its `first_seen_at` scan with early exit (the
unary `+` stops the planner from preferring the liveness index there).

### Row-write budget

Ingestion upserts every record on every run, and D1 Free allows 100,000 row writes per
day. Every upsert (`institutions`, locations, `sources`, profiles, `courses`,
`course_editions`) now carries a `DO UPDATE ... WHERE` guard that compares the stored
values, so an unchanged record writes nothing there. The only unavoidable write per
unchanged record is its `source_records` row, which advances the last-seen and
last-verified timestamps required for provenance, plus the run's own two rows. For the
four-record fixture an unchanged re-import went from 18 row changes to 6; at hundreds
of centres this is roughly a third of the writes. Reviewed titles and manual
corrections are never in the compared columns, and the search-index triggers only fire
when a title actually changes. If writes ever become the limit again, the next step is
to track verification per run instead of per record.

### Calendar dates and time zones

Dates are ISO `yyyy-MM-dd` strings handled with date-fns; zone-aware "today" uses
`@date-fns/tz`. No place is hard-coded: each centre record carries an IANA `timezone`
(validated at load time), and the cutoff that decides whether an edition has ended is
the earliest current local date across the time zones of the institutions in the
database (`src/lib/db/clock.ts`, zones memoized for five minutes, UTC when none). An
edition is therefore never hidden before it has ended in its own zone; one in a zone
further ahead can stay listed up to a day longer. Source dates are parsed with exact
Catalan month names taken from the date-fns locale and validated as real calendar
days. Display still uses `Intl.DateTimeFormat`, because date-fns' Catalan patterns
lack the "de" and apostrophe elision that Intl produces.

### Read paths

Public pages no longer query D1 per request ([ADR 0008](adr/0008-static-site.md)).
`src/lib/catalog/export.ts` reads everything the static build publishes in one pass:
geography, institution locations and time zones, centre profiles and map points
(bounded at 1,000 rows each, 500 map points plus a truncation flag), and every
edition with its source record, keyset-paginated by the `source_records` primary key
in pages of 500 and capped at 50,000. The export fails instead of truncating, and its
result is validated, so a schema drift fails the build rather than a page.

The discovery orderings and filters of the former SQL queries are reproduced in
`src/lib/catalog/query.ts` (SQLite BINARY collation, the `live_until` sentinel for
unknown end dates, category groups expanded before pagination). The integration tests
run the same assertions as before through export + pure code.

Only the alert pages use D1 at request time, and only for subscriptions. The categories
and cities their form offers come from `/alerts/options.json`, prerendered from the
snapshot and read through the Worker's `ASSETS` binding (`src/lib/alerts/options.ts`).

Discovery sorts unexpired cancelled editions last before pagination; the homepage
excludes them. Search accepts `cancellation=hide` or `cancellation=only` (omitting it
shows all). The filter composes with geography, centre, category, search, and price,
and narrows dependent centre/category options. Source prices remain stored even when
a zero price is hidden on a cancelled card.

### Alert subscriptions (personal data)

`0011_course_alerts.sql` adds `alert_subscriptions`, the only table holding personal
data (an email address). Each row targets a category, a city, or both; a CHECK
enforces that at least one is set. The unique expression index on
`(email, ifnull(category,''), ifnull(city_id,''))` allows one row per address and
target. The city references `cities(country_code, id)`. Confirmed rows always have
`confirmed_at` and `last_digest_at`; confirmation sets `last_digest_at`, so finding
due digests is one indexed range on `(status, last_digest_at)`.

No token is stored: links are HMAC-signed from the row id. Retention: unsubscribing
deletes the row, and the alerts job deletes pending rows older than 7 days.
`listNewCourses` reads the `source_records_first_seen` index once per digest run,
capped at 2,000 editions.
