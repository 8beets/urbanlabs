# Local development and testing with Docker

Docker provides a consistent Linux environment for the Cloudflare runtime and browser tests. The image uses Node 26 on Debian Bookworm and installs Chromium and its system libraries using the project's locked Playwright version. It is a development/test image, not a production deployment.

## Start

Install a Docker engine with Docker Compose support, start the engine, and ensure the CLI is on your shell’s `PATH`. Confirm it is available:

```sh
docker --version
docker compose version
```

If either command is unavailable, follow your Docker installation's CLI setup
instructions. After changing `PATH`, restart your terminal and any editor sessions
that need the updated environment.

From the repository:

```sh
docker compose build
docker compose up -d app
```

Open http://127.0.0.1:4321/es/. The app applies local migrations and exports a catalogue snapshot before starting, and shows an honest empty state until data is imported. Source edits are bind-mounted for Astro's development reload.

Fetch an approved public source into the container's local D1:

```sh
docker compose exec app npm run ingest:live -- --source miram-sant-andreu
docker compose exec app npm run snapshot
```

Pages are built from a catalogue snapshot ([ADR 0008](adr/0008-static-site.md)); the
app exports one at start-up, and `npm run snapshot` refreshes it after an import (the
dev server picks up the new file on the next request).

Stop the app while retaining its database:

```sh
docker compose down
```

## Run checks

```sh
docker compose run --rm checks
```

This runs formatting, linting, binding generation, TypeScript checks, deterministic tests, actual local D1 tests, migrations, a static build from the fixture snapshot with its asset budgets, and desktop/mobile Playwright tests against that build. Its temporary database is separate from the app's database, so the suite can run without importing test fixtures into browsing data. It does not fetch live course websites.

Browser tests additionally use `.wrangler/e2e-state` and port 4322, with synthetic fixture records for centre/category navigation and pagination. This test state is distinct from `.wrangler/state`, even when running tests natively alongside the browsing app.

You can also run a focused command:

```sh
docker compose run --rm checks npm run test:d1
```

The first build downloads a Linux image, dependencies, Chromium, and browser system libraries. Subsequent builds reuse layers. Docker stores `node_modules` in a named volume, separate from host dependencies, and the app's local D1 data in another named volume. Generated build/browser artifacts stay in temporary container volumes. No Docker socket or host Cloudflare configuration is mounted; the project configuration uses local D1 only.

After changing the lockfile, rebuild and refresh the Linux dependency volume before starting checks:

```sh
docker compose build
docker compose run --rm checks npm ci
```

Avoid `docker compose down --volumes` unless you deliberately want to delete the app's local course database and dependency cache.

## Verification

The repository's full check suite has been exercised in the Linux Docker environment,
including actual D1 persistence and desktop/mobile browser tests. Test results are
specific to the checkout and environment: run the checks for your changes and use
[CI](https://github.com/8beets/urbanlabs/actions/workflows/ci.yml) for commit-level results.

References: [Playwright Docker setup](https://playwright.dev/docs/docker),
[Docker bind mounts](https://docs.docker.com/engine/storage/bind-mounts/).
