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
upsert reviewed profiles from `src/lib/institutions/profiles.ts`. Missing optional
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

`0007_cancelled_editions.sql` adds the constrained `course_editions.is_cancelled`
flag. It records an explicit source cancellation separately from availability. Zero
means no cancellation has been recorded, not that the course is available. Existing
rows start at zero and need a successful source refresh to detect notices that were
not previously extracted. Apply the migration before deploying or running ingestion.
Failed imports preserve the flag and verification timestamps with the prior snapshot.

`0008_course_title_search.sql` adds the FTS5 table `courses_fts` (course id and the displayed title: reviewed title first) plus triggers that keep it current. The `unicode61 remove_diacritics 2` tokenizer makes title search case- and accent-insensitive.

Discovery sorts unexpired cancelled editions last before pagination; the homepage
excludes them. Search accepts `cancellation=hide` or `cancellation=only` (omitting it
shows all). The filter composes with geography, centre, category, search, and price,
and narrows dependent centre/category options. Source prices remain stored even when
a zero price is hidden on a cancelled card.
