# UrbanLabs

A free, open-source directory of affordable, in-person courses and workshops from local community organizations. Starting in Barcelona, with Spanish and Catalan interfaces.

UrbanLabs helps people discover courses and visit the organizer's official listing. It does not handle bookings, payments, or learning management.

**Public preview:** https://urbanlabs.fyi — 777 source-verified course editions across 11 Barcelona centres. This is a preview; availability remains unconfirmed and automated refresh is not configured.

## Features

- Astro + strict TypeScript, Tailwind CSS, Cloudflare Workers, and D1 configuration.
- Reusable Miram adapter with institution configuration separated from extraction.
- Versioned relational schema, atomic imports, stable identifiers, provenance, and failed-run tracking.
- Spanish (`/es/`) and Catalan (`/ca/`) homepages show the latest 20 added, unexpired course editions. Dedicated search pages (`/es/buscar`, `/ca/cerca`) offer filters and pagination.
- Browse by civic centre and normalized course category; category options reflect the selected centre, and equivalent provider categories share one filter. Combine these with region, city, search, and price using shareable URLs. Spain is the default country (the country selector is hidden); Cataluña/Catalunya, Barcelona, and Tarragona are available. Tarragona has no imported courses yet. Community, city, and centre changes update dependent filter options without reloading; use Search to apply the selection to results.
- Localized centre directories and individual centre pages with verified contact details, shared Leaflet/OpenStreetMap maps, and upcoming courses.
- Deterministic unit/SQLite contract tests, a separate D1 runtime suite, Playwright tests, and CI.

Sources verified on 2026-11-06:

| Centre                | Stored editions |
| --------------------- | --------------: |
| Sant Andreu           |              37 |
| Can Basté             |              99 |
| Pati Llimona          |              56 |
| Casa Golferichs       |             113 |
| La Casa Elizalde      |             195 |
| Albareda              |              27 |
| El Sortidor           |              50 |
| Vil·la Urània         |             133 |
| Urgell                |              42 |
| FAB Casa del Rellotge |              14 |
| FAB Casa del Mig      |              11 |

All use the reusable Miram adapter, with deterministic category grouping and separate institution/source configuration. Online-only workshops, reviewed shows/meetups, and unidentified advance previews are excluded. Stored totals include expired editions; availability remains unknown. Local D1 starts empty until a real import runs.

The interface uses a blue and yellow palette, locally served Bricolage Grotesque headings, and an illustrative workshop photo mosaic. Course cards group the category, centre, dates, price, and official source link for easy scanning. Navigation, filters, and cards adapt to narrow mobile screens. The responsive filter sidebar, removable applied filters, and language links also work without JavaScript. All-uppercase course titles use readable sentence casing with known acronyms preserved; manually reviewed titles retain their casing. Original source text and language are preserved. See [asset credits](docs/assets.md).

## Local setup

Clone the repository:

```sh
git clone https://github.com/8beets/urbanlabs.git
cd urbanlabs
```

Choose Docker Compose or a native Node.js environment. Both use local D1 storage;
Cloudflare credentials are not needed for local development.

### Docker Compose

Install Docker with Compose support and start its engine. Then run:

```sh
docker compose build
docker compose up -d app
```

Open http://127.0.0.1:4321/es/. The app applies local migrations automatically.
To import real course data from one approved source:

```sh
docker compose exec app npm run ingest:live -- --source miram-sant-andreu
```

Run the full check suite with `docker compose run --rm checks`. See the
[Docker guide](docs/docker.md) for persistent storage and dependency updates.
An [editor dev-container configuration](.devcontainer/devcontainer.json) is also
provided; its setup has not been verified separately from Docker Compose.

### Native Node.js

Use Node.js 24, npm, and an operating system supported by the project's Cloudflare
runtime. If the runtime cannot start on your host, use the Docker setup above.

```sh
npm ci
npm run db:types
npm run db:migrate
npm run dev
```

Open http://127.0.0.1:4321/es/. Local D1 data is stored at `.wrangler/state/v3`.
The database starts empty; in another terminal, import an approved source when needed:

```sh
npm run ingest:live -- --source miram-sant-andreu
```

`npm run ingest` only prints instructions. `npm run ingest:live` explicitly opts
into fetching approved public sources and writing local D1. `npm run source:verify`
fetches and validates without database writes. See [source research](docs/data-sources.md)
for supported sources and access policies.

## Checks

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:d1
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm test` uses saved source fixtures and real Node SQLite for SQL contract tests.
`npm run test:d1` exercises the actual local D1 runtime separately. Playwright covers
Spanish and Catalan discovery, filtering, pagination, centre pages, embedded-map
URLs, language switching, legacy redirects, and desktop/mobile behaviour. Routine
tests do not contact source websites or map services.

The [CI workflow](https://github.com/8beets/urbanlabs/actions/workflows/ci.yml)
runs formatting, lint, TypeScript, unit/D1 tests, migrations and the build on Linux,
then deploys successful pushes to `main` to Cloudflare. Playwright is temporarily
skipped in GitHub Actions; run browser tests locally or with Docker. See [deployment setup](docs/deployment.md#automatic-deployment-from-github)
for the required GitHub secrets. The [Docker check suite](docs/docker.md#run-checks)
also includes binding generation and local migrations. For hosts without Chromium's
system dependencies, use Docker or follow Playwright's browser installation guidance.

## Documentation

- [Asset credits and logo](docs/assets.md)
- [Design screenshots (test fixtures)](docs/screenshots/README.md)
- [Page and static asset cache policy](docs/caching.md)
- [Source research](docs/data-sources.md)
- [Architecture](docs/architecture.md)
- [Adapter development](docs/ingestion.md)
- [Database and migrations](docs/database.md)
- [Deployment boundaries](docs/deployment.md)
- [Docker development and testing](docs/docker.md)
- [Contributing](CONTRIBUTING.md)
- [Agent instructions](AGENTS.md)

## Not implemented yet

Individual course detail pages, normalized individual sessions, scheduled ingestion, stale-record policies, administration, submissions, full-text/accent-insensitive search, and public SEO configuration. The public preview deliberately retains `noindex` while canonical URLs, sitemaps, source reuse conditions, and complete expired-edition behavior remain under review. Cloudflare Workers and D1 are deployed with Free-plan-compatible configuration; no paid services or plan upgrades were enabled. See [deployment instructions](docs/deployment.md).

Licensed under the [MIT License](LICENSE). Third-party photographs and icons retain their respective licenses; see [asset credits](docs/assets.md).
