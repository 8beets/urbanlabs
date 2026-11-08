# ADR 0004: Centre registry as validated data

Status: accepted

## Context

Every approved centre needed a TypeScript source file, an entry in the source list, a
profile in a second file, test cases, and prose. With tens or hundreds of centres this
is slow to review, conflict-prone, and mixes institution data with code. AGENTS.md asks
that a new institution on a supported platform need only configuration.

## Decision

- Centres are JSON records in `data/centres/<country>/<city>.json`, validated at load
  time by a Zod schema (`src/lib/centres/schema.ts`). Approved sources and reviewed
  profiles are generated from the registry; source IDs (`miram-<slug>`) are unchanged.
- `registration` is a discriminated union on `platform`. Only Miram exists; a new platform
  adds a union member and its own adapter, not a plugin framework.
- Registration hosts are allowlisted (https, no port or credentials, approved host
  suffixes) because they are fetched automatically. Exclusions require a written reason.
  `robotsTxt` accepts only `absent`, matching the importer's refusal to run when a
  policy appears.
- The registry stays in the repository rather than D1: changes are reviewed in pull
  requests, validated in CI, and carry provenance. D1 receives the data through the
  existing registration and `centres:sync` paths.
- `npm run centre:probe` automates the mechanical checks (robots.txt, navigation, footer,
  category list) and prints a draft whose unverified fields are `TODO` markers that fail
  validation. People still verify identity, contact details, and coordinates.
- Files are organised by country and city so large cities do not share one file with
  every other city. Files are imported explicitly in `registry.ts`; a test fails if a file
  is missing there or a record sits in the wrong file.

## Consequences

- Adding a Miram centre is one reviewed JSON record, with a fixture only for new markup.
- Generic contract tests replace per-centre cases and hardcoded totals.
- A very large single city can still make its file long; split it by district then.
- Migration was verified lossless: the generated source configurations and profiles are
  deep-equal to the former hand-written ones.
