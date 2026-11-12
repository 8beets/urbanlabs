# Architecture

This is one Astro application, not a monorepo. Public pages are prerendered as static files from a catalogue snapshot of D1 and served as Workers static assets; only the alert pages and the 404 page run on the Worker ([ADR 0008](adr/0008-static-site.md), see [Static site](#static-site) below). Paraglide message catalogs contain translated interface text. Source titles stay in their original language. Original schedule text remains stored unchanged; the Spanish interface translates known Catalan weekday names and weekday-list conjunctions without changing times, translating arbitrary prose, or inferring sessions.

At build time, pages read the snapshot through `src/lib/catalog/pages.ts`; discovery is a set of pure functions over that data (`src/lib/catalog/query.ts`, `discovery.ts`) that the browser search reuses. The alert pages call services that use the centralized database repository. Components receive view data and never query D1. External HTML is escaped by Astro; the importer does not publish source descriptions or execute scripts.

The ingestion adapter handles fetching and extraction, returning validated domain records without knowing about persistence. The runner registers the source and records an ingestion attempt, fetches the entire bounded snapshot, validates it, and commits courses, editions, provenance, and successful-run status in one D1 batch transaction. Failed attempts record an error while preserving existing course data.

D1 is the only canonical persistent store. Node SQLite validates SQL and transaction behavior in tests and was also used in memory to prepare the initial verified cloud-data seed. Runtime tests use actual local D1 separately.

Local Docker development uses a Linux Node 26 image with separate volumes for dependencies and the app's D1 state. The checks service has its own temporary state and includes Chromium, so runtime and browser checks run in the same Linux environment across supported Docker hosts. See [Docker setup](docker.md).

The initial UI provides title search, price filtering, and bounded pages of 12 editions. Title search follows the SQLite FTS5 index `courses_fts` (migration `0008`, `unicode61 remove_diacritics 2`): `src/lib/catalog/title-match.ts` reproduces it for the static search, so matching ignores case, accents, and composed/decomposed Unicode (`fotografia` finds `Fotografía`). Each typed word must match the start of a title word; mid-word substrings (`graf`) do not match, and query operators are plain words. Triggers keep the index in sync with `title` and `reviewed_title`, and `courses` keeps the original accented titles for display. Note that D1 cannot export databases containing virtual tables.

No account is required for browsing. No analytics, trackers, cookies, sessions, Images binding, KV, R2, Queues, or Durable Objects are configured. Cron Triggers are deferred. The ingestion CLI runs outside a public Worker request; there is no public ingestion endpoint.

Centre and category navigation uses real database values, parameterized equality filters, and a category index. Navigation preserves other filters, resets pagination when a centre/category changes, and keeps selections when switching languages. Category interface labels are localized; source values remain unchanged in D1 and URLs. Category/centre choices include non-expired offerings independently of the current text and price filters, allowing users to change either dimension even when a combination has no results.

## Discovery categories

Courses are listed under one of 13 fixed topics (ADR 0009) and optionally one audience (families, children and young people, older people). `src/lib/courses/categories.ts` holds the reviewed tables and title rules and is the only place that decides either. Classification is a pure function of the stored source category and title, run at build time and in the browser search, so changing the tables needs only a rebuild. D1 keeps original category values unchanged for provenance.

Topic ids are the `?category=` values and the category page slugs. Older links and alert subscriptions that name a source category or a former group still work: a value the tables map to one topic selects that topic, and any other value matches its source category exactly. Topic choices follow the selected location and centre, in a fixed order.

Spanish and Catalan Paraglide catalogs provide topic and audience labels. An unknown all-caps source category from an old link receives sentence casing without inventing a translation. Source titles and descriptions are unaffected. Selecting a different centre retains other filters; an incompatible category can yield an empty result and can be removed using the all-categories link or clear-filters action.

Search, centre, category, and price controls share one GET form in `CourseFilters.astro`. The form occupies a sidebar beside results from 800px upward and a native `<details>` panel above results on smaller screens. A small client script sets the initial/resized disclosure state; without JavaScript the panel starts open and remains keyboard-collapsible. Applied filters remain visible outside the panel, each with a removal link, alongside a clear-all action. The footer links to the GitHub repository with a locally served Octicons mark and a localized text label.

## Responsive filtering (issue #3)

Centre/category selects retain combined filter values, including a visible current-selection fallback when a category is unavailable at the selected centre. Submitting the GET form omits `page`, resetting pagination. Removing one applied filter also resets the page and retains other parameters. Language links and result pagination retain the query string. Extra query parameters survive form submissions. Region and city controls share this same form; location filtering composes with all existing filters. Spain is the default country, carried in a hidden input rather than a visible selector.

Future location/date/time fields belong in the existing sidebar form and must be added to its `formFields` set, validated by the service, and reflected in the applied-filter summary. Do not add placeholder controls for unimplemented filters. Mobile validation errors leave the panel open, labels use native associations, and keyboard disclosure/focus works with and without JavaScript. Browser coverage exercises both layouts, combined filters, centre-specific options, legacy category URLs, incompatible selections, pagination, clear/remove actions, locale switching, and responsive disclosure.

Centre navigation uses `/es/centros` and `/es/centros/[slug]` in Spanish, and `/ca/centres`
and `/ca/centres/[slug]` in Catalan. A shared native Astro layout provides primary
navigation and switches locale while retaining the centre and pagination. Directory
queries include institutions without courses, with 24-item pagination. Detail pages
reuse bounded course queries scoped to the selected institution (12 per page), and
show verified contact information and an embedded OpenStreetMap map. Unknown slugs
return 404; invalid pagination returns 400; database outages return 503. Profile
metadata and provenance are separate from external course parsing.

Routing follows [Astro's built-in internationalization](https://docs.astro.build/en/guides/internationalization/).
`astro.config.mjs` configures `es` (default) and `ca` with `prefixDefaultLocale: true`.
Localized pages live in matching `src/pages/es/` and `src/pages/ca/` folders.
Shared navigation uses the helpers in `src/i18n/paths.ts`, which build the same
prefixed URLs as `astro:i18n` without that virtual module so browser scripts can use
them, with explicit translated path segments (`buscar`/`cerca`, `centros`/`centres`).
`public/_redirects` sends the bare domain `/` to `/es/`; old unprefixed URLs such as
`/centros` are not redirected and return 404.
The search index (`/search/*.json`) and static assets remain outside locale folders.

All page navigation includes a locale prefix: Spanish discovery is `/es/` and
Catalan discovery is `/ca/`. Filters, pagination, centre links and language
switching retain that prefix. `/` redirects to `/es/`; the old unprefixed `/centros`
and `/centros/[slug]` URLs are no longer redirected (ADR 0008).
Static assets and third-party source/map URLs retain their own paths.

Directory and individual centre maps use `InteractiveCentreMap.astro` and the shared
`src/lib/institutions/centre-map.ts` browser initializer. Stable Leaflet 1.9 is the
small map dependency; no UI framework is introduced. Its code and styles are bundled
locally and imported when a map approaches the viewport. Keyboard markers open
localized centre links using DOM text nodes, rather than source HTML. Zoom/pan
animations and scroll-wheel zoom are disabled; native lists remain usable without
JavaScript. Tile failures retain the markers, directory and external map links.

A separate bounded D1 query supplies map points across directory pages, including
centres with no courses. It selects only verified HTTPS-sourced coordinates and
caps the browser payload at 500 points plus a sentinel. If that cap is exceeded,
the map explicitly indicates it is partial; the 24-item paginated directory remains
complete. Add geographic selection before expanding the map beyond that bound.
Single-centre pages reuse the same component with one verified point and retain
municipal provenance. This change needs no schema migration or additional cloud
resource. Tile requests use the browser cache and Referer; there is no tile proxy,
bulk download or offline prefetch.

Course title casing is presentation-only. `src/lib/courses/title.ts` formats titles
only when all their cased letters are uppercase. It uses Spanish/Catalan-aware
sentence casing and an explicit spelling table for known acronyms and names such
as IA, API, HTML, Arduino, ESP32 and TouchDesigner. Correctly cased, mixed-case and
lowercase titles remain unchanged. Unknown proper names cannot be recovered from
uppercase text; extend the reviewed spelling table or use a manual title correction
when needed. Do not use this formatter for ingestion, identity or persistence.

The shared `CourseCard.astro` applies formatting consistently in discovery and
centre listings, exposing the original title as a native title attribute when its
casing changes. Database queries expose whether a title was manually reviewed;
reviewed titles bypass formatting. Original titles and source-record payloads stay
unchanged. Future course detail pages should reuse the formatter and preserve
manual review intent in the same way.

The shared page shell uses the viewport width with 20px side gutters, rather than a
fixed desktop maximum. Header, main content and footer align at every viewport size.
Course/directory grids add columns as space permits; text paragraphs and decorative
hero images retain readable bounds. The filter sidebar keeps its existing desktop
width and mobile disclosure behaviour.

## Homepage and dedicated search

The localized homepages load at most 20 unexpired course editions through
`listLatestCourses`, ordered by source-record `first_seen_at` descending, then stable
source/external identifiers for ties. Reimports preserve `first_seen_at`, so refreshes
do not promote older courses. Unknown end dates remain eligible without inferring
availability. Migration `0004_source_records_first_seen.sql` adds the ordering index.

Search and filters live at `/es/buscar` and `/ca/cerca`, retaining the existing
12-item pagination, sidebar, validation and URL state. The homepage has no filters
or pagination. Its primary action, header Courses link and course-category links
lead to search. Recognized filter parameters on old homepage URLs redirect with
HTTP 308 to the corresponding search page, preserving the query string. Unrelated
homepage parameters, such as campaign links, do not cause a redirect. Both homepage
and search pages retain shared course cards, verified source links, title casing
and language switching. The current visual design and centre routes are preserved.

## Geographic discovery

Countries, regions, cities, and institution assignments are normalized reference tables.
Sources explicitly configure a city ID and country; free-form city/address text is
retained for display and never used to guess an assignment. Region and country are
resolved through foreign keys. Geography filters use parameterized SQL, and centre
and category options respect the selected location. An incompatible selected centre
or category stays visible and removable and can produce zero results.

The reference catalog seeds Spain, Catalunya, Barcelona, and Tarragona. Tarragona
has no imported courses; its empty state does not link to unrelated Barcelona
programmes. The region label is Cataluña in Spanish and Catalunya in Catalan.
Selections survive pagination and language switching. City options follow the region;
a small progressive enhancement clears the city after a region change without
submitting automatically. Without JavaScript, known stale child selections are
removed by the server with a 302 redirect to the reconciled URL, resetting pagination
and preserving other filters. Unknown or malformed IDs return HTTP 400.

The reference catalog is bounded to 1,000 rows per table, independently of course
volume; exceeding that bound produces an explicit unavailable response, never silent
truncation. Before exceeding it, replace the catalog lookup with scoped queries.
Adding Asturias requires reference rows in a new migration and explicit city IDs in
source configuration; the adapter, SQL filters, and UI do not need a rewrite.

## Dependent filter options

Changing community, city, or centre recomputes the dependent select options in the
browser from the already loaded search index (no request). Community changes
also reset the city locally. Centre options follow geography; category options
follow geography and centre. Unavailable centre/category selections are cleared,
while compatible selections, keyword, and price are retained. Results and the URL
change only when the user submits the search form.

The read-only endpoint validates location and centre identifiers, localizes option
labels, and reuses the existing bounded centre/category queries without loading
course records. Successful responses can be cached by the browser for 60 seconds;
errors are not cached. Requests are cancelled when superseded and time out after
10 seconds. The form announces loading or failure, blocks submission while an
update is pending, and re-enables normal search on failure. Without JavaScript,
the native GET form retains the existing server-rendered filtering behavior.

## Translation compilation

[Issue #62](https://github.com/8beets/urbanlabs/issues/62) uses Paraglide for all
translations: interface and accessibility text, error states, category labels,
reviewed place names, and known weekday terms. `messages/es.json` and
`messages/ca.json` are the source of truth. `project.inlang/settings.json` selects
the locales and locally installed message-format plugin; `paraglide.config.mjs`
shares compiler options between the CLI and Astro Vite integration. Generated
JavaScript and TypeScript declarations in `src/paraglide/` are ignored.

Messages use explicit `{ locale }` arguments in components and API helpers.
Astro continues to own locale routing and URL generation. Paraglide uses only its
base-locale strategy as a default; no middleware, cookies, browser detection, or
mutable global locale is needed. Client enhancements receive translated labels
from HTML attributes instead of loading translation catalogs in the browser.
Dates and prices use native locale-aware `Intl` formatting. Source content and
unknown labels are preserved rather than automatically translated.

## Email alerts (issue #80)

`src/lib/alerts/` is a small domain/ports/adapters module (ADR 0007):

- `subscription.ts`: pure rules for request validation, digest matching, resend
  limits and HMAC-signed confirm/unsubscribe tokens.
- `email-sender.ts`: the `EmailSender` port. `adapters/brevo.ts` (production) and
  `adapters/log.ts` (local and E2E only) implement it. `sender.ts` chooses one from
  `EMAIL_PROVIDER`.
- `emails.ts`: localized plain-text and HTML rendering. Course titles stay in their
  source language, and all source text is escaped.
- `service.ts`: the use cases (`requestSubscription`, `confirm`, `unsubscribe`,
  `sendDueDigests`, `purgeUnconfirmed`). They depend only on the port and the
  repositories, which use the `IngestionDatabase` interface. The same code therefore
  runs in the Worker (D1 binding) and in the GitHub Actions job (Wrangler CLI).
- `page.ts` and `adapters/turnstile.ts`: the Worker-side page loaders for
  `/es/alertas`, `/ca/alertes` and their `confirmar` and `baja`/`baixa` routes.

Alert pages are rendered on demand with `Cache-Control: no-store` and are outside
the public edge-cache allowlist. The search page links to the form, prefilled with
the current category and city, only when `alertsConfigured` finds every setting.

## Static site

Decided in [ADR 0008](adr/0008-static-site.md) (issue #89).

- `scripts/export-snapshot.ts` (`npm run snapshot`, `snapshot:production`) reads D1
  with bounded queries (`src/lib/catalog/export.ts`) and writes a validated snapshot
  (`.cache/snapshot.json`, or `URBANLABS_SNAPSHOT`). It never writes to D1.
- `astro build` prerenders every public page from that snapshot in Node
  (`prerenderEnvironment: 'node'`, `build.format: 'preserve'`): homepages, the search
  shell, the centre directory, centre pages (`/es/centros/[slug]`, `/[slug]/2`, …),
  and category pages (`/es/buscar/categoria`, `/es/buscar/categoria/[slug]`, …) that
  keep the catalogue browsable without JavaScript.
- The build also writes `/search/live.json` and `/search/archive.json`
  (`src/lib/catalog/search-index.ts`). `src/lib/catalog/search-page.ts` loads them,
  runs `discover()` for the URL query and renders results with
  `discoveryResultsHtml()` and `courseCardHtml()`, the same functions the build uses.
  While a filtered search loads, the prerendered unfiltered results stay hidden.
- Invalid filters show the accessible error message (no HTTP 400 on a static page);
  stale geographic selections are dropped with `history.replaceState`.
- The centre directory lists every centre; with JavaScript, a filter form narrows the
  list as the user types (`src/lib/institutions/directory-filter.ts`).
- Prerendered cards carry `data-live-until`; `ExpiredCards.astro` hides editions that
  ended since the build. Daily rebuilds remove them.
- Alert pages (`prerender = false`) and the 404 page run on the Worker with D1.
  `alertsAdvertised()` decides at build time, from public configuration only,
  whether static pages link to alerts.
