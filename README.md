# UrbanLabs

A free, open-source directory of affordable, in-person courses and workshops from local community organizations. Live in Barcelona, El Prat de Llobregat, Girona and Zaragoza, with Spanish and Catalan interfaces.

UrbanLabs helps people discover courses and visit the organizer's official listing. It does not handle bookings, payments, or learning management.

**Public preview:** https://urbanlabs.fyi — about 3,000 current, source-verified course editions from 69 centres: 46 in Barcelona and 23 Zaragoza civic centres (counts from 2026-11-12). Sources are refreshed daily by a scheduled GitHub Actions ingestion; availability remains unconfirmed.

## Features

- Astro + strict TypeScript, Tailwind CSS, Cloudflare Workers, and D1 configuration.
- Reusable adapters (Miram registration sites, Zaragoza's civic-centre events API, Girona's municipal registration system, El Prat de Llobregat's course guide, Alicante Aula Abierta, Tarragona, Vitoria-Gasteiz and Sabadell civic centres) with centre configuration separated from extraction.
- Versioned relational schema, atomic imports, stable identifiers, provenance, and failed-run tracking.
- Spanish (`/es/`) and Catalan (`/ca/`) homepages show the latest 20 added, unexpired course editions from every city.
- One section per city ([ADR 0010](docs/adr/0010-city-sections.md)): `/es/<city>/` lists its topics, `/es/<city>/cursos` searches its courses (topic pages at `/es/<city>/cursos/<topic>`), and `/es/<city>/centros` lists its centres. The header's Cursos and Centros menus, `/es/cursos` and `/es/centros` list the cities. Catalan uses `/ca/<city>/cursos` and `/ca/<city>/centres`.
- Search by title, centre, topic, audience, start month, price and availability using shareable URLs; category options reflect the selected centre, and equivalent provider categories share one topic.
- Localized centre directories per city and individual centre pages with verified contact details, shared Leaflet/OpenStreetMap maps, and upcoming courses.
- Localized 404 page with links to the homepage, course search, and centre directory; unknown URLs default to Spanish unless prefixed with `/ca/`.
- Explicit source cancellations are labelled in Spanish and Catalan, sorted after other courses, and excluded from the homepage. Search can hide or show only cancelled courses; zero prices are hidden on cancelled cards.
- Weekly email alerts for new courses by category and/or city: Turnstile-protected double opt-in, one-click unsubscribe that deletes the data, and a swappable email provider (Brevo free tier). Disabled until production email is configured; see [ADR 0007](docs/adr/0007-email-alerts.md).
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

## Translations

Spanish and Catalan translations live in `messages/es.json` and `messages/ca.json`.
Paraglide compiles them during development/builds and before type checks/tests.
See [contributing translations](CONTRIBUTING.md#translations) for the workflow.

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

Use Node.js 26 (LTS), npm, and an operating system supported by the project's Cloudflare
runtime. If the runtime cannot start on your host, use the Docker setup above.

```sh
npm ci
npm run db:types
npm run db:migrate
npm run dev
```

Open http://127.0.0.1:4321/es/. Local D1 data is stored at `.wrangler/state/v3`.
Public pages are built from a catalogue snapshot ([ADR 0008](docs/adr/0008-static-site.md)),
so export one after importing data, and again whenever local data changes:

```sh
npm run ingest:live -- --source miram-sant-andreu
npm run snapshot   # local D1 → .cache/snapshot.json
```

Without real data, `npm run snapshot:fixture` seeds an isolated database from the
saved test fixtures and writes `.cache/e2e-snapshot.json`; point the build or dev
server at it with `URBANLABS_SNAPSHOT=.cache/e2e-snapshot.json`.

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
npm run e2e:build
npm run check:build
npx --no-install playwright install chromium
npm run e2e   # reuses the build; npm run test:e2e builds first
```

`npm test` uses saved source fixtures and real Node SQLite for SQL contract tests.
`npm run test:d1` exercises the actual local D1 runtime separately. Playwright covers
Spanish and Catalan discovery, filtering, pagination, centre pages, embedded-map
URLs, language switching, the root redirect, and desktop/mobile behaviour, against the
static build served by `wrangler dev` (assets first, alert pages on the Worker). Routine
tests do not contact source websites or map services.

The [CI workflow](https://github.com/8beets/urbanlabs/actions/workflows/ci.yml)
runs formatting, lint, TypeScript, unit/D1 tests, migrations, a fixture build and its
asset budgets on Linux, then deploys successful pushes to `main` to Cloudflare. The
[deployment workflow](.github/workflows/deploy.yml) also rebuilds from production data
after each ingestion run and daily. Playwright is temporarily
skipped in GitHub Actions; run browser tests locally or with Docker. See [deployment setup](docs/deployment.md#automatic-deployment-from-github)
for the required GitHub secrets. The [Docker check suite](docs/docker.md#run-checks)
also includes binding generation and local migrations. For hosts without Chromium's
system dependencies, use Docker or follow Playwright's browser installation guidance.

## Documentation

- [Asset credits and logo](docs/assets.md)
- [Design screenshots (test fixtures)](docs/screenshots/README.md)
- [Static site and cache policy](docs/caching.md)
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
