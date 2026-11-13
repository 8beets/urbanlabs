# AGENTS.md — UrbanLabs

## Project overview

UrbanLabs is a free, open-source, nonprofit-oriented platform for discovering affordable, in-person courses and workshops offered by local community organizations.

The project starts in Barcelona, Spain, with an architecture designed to support additional cities and countries.

**Product name:** UrbanLabs

**Repository/package name:** `urbanlabs`

**Default locale:** Spanish (`es`)  
**Secondary locale:** Catalan (`ca`)

**Mission:** Make local learning opportunities easier to discover, regardless of category, institution, or technical ability.

UrbanLabs is a discovery platform, not a learning management system, booking platform, or commercial marketplace.

## 1. Agent operating principles

When working in this repository:

1. Prefer working software over speculative architecture.
2. Prioritize correctness, maintainability, and simplicity.
3. Make small, focused, verifiable changes.
4. Follow existing conventions before introducing new patterns.
5. Avoid unnecessary abstractions, dependencies, and infrastructure.
6. Use current official documentation when implementing framework-specific functionality.
7. Never fabricate external data or claim an integration works without testing it.
8. Keep the project compatible with Cloudflare's Free plan.
9. Do not introduce paid services without explicit approval.
10. Do not deploy to production or modify production resources without explicit approval.

Work autonomously on ordinary implementation decisions.

Ask for clarification only when a decision materially affects product scope, security, costs, or external resources.

## 2. Development priorities

The project follows an **ingestion-first development strategy**.

Priority order:

1. Research real course data sources.
2. Implement and validate reusable source adapters.
3. Persist normalized data in D1.
4. Implement public course discovery.
5. Add scheduled ingestion and monitoring.
6. Implement administration and community contributions.
7. Improve SEO, accessibility, performance, and documentation.

Do not prioritize visual polish over reliable data ingestion.

Do not build functionality around fictional courses when real data can be obtained.

Mock data is allowed in isolated tests and development fixtures, but must never be presented as verified real data.

## 3. Technology stack

Preferred technologies:

- Astro
- TypeScript with strict mode
- Cloudflare Workers
- Cloudflare D1 / SQLite
- Tailwind CSS
- Wrangler
- Vitest
- Playwright
- GitHub Actions

Use the latest stable compatible versions, not necessarily the newest prerelease versions.

Prefer native Astro components.

Use client-side JavaScript only when necessary.

Do not introduce React, Vue, Svelte, or another UI framework without a concrete technical justification.

Evaluate additional dependencies based on maintenance burden, bundle size, runtime compatibility, and actual requirements.

Do not introduce external databases, hosted search engines, or commercial AI services.

## 4. Architecture boundaries

Keep the system organized around clear responsibilities.

Suggested structure:

```text
src/
  commands/
  components/
  layouts/
  pages/
  i18n/
  lib/
    db/
    courses/
    search/
    ingestion/
      adapters/
      normalization/
      validation/
    sources/
    institutions/
  styles/

migrations/
tests/
  fixtures/
  unit/
  integration/
  e2e/
docs/
  adr/
```

Adapt this structure to actual project needs.

Avoid creating unnecessary packages or a monorepo.

### Dependency direction

- UI components must not directly implement database queries.
- Route handlers should delegate business logic to services.
- Ingestion adapters must not depend on UI code.
- Domain logic should remain independent of Cloudflare-specific APIs where practical.
- Database access should be centralized.
- External source parsing should remain isolated from persistence.
- Shared types and schemas should have a single authoritative definition.

Avoid circular dependencies.

## 5. Data ingestion rules

Data ingestion is the most important technical subsystem.

### Source selection

Prefer sources in this order:

1. Official public APIs.
2. Official structured datasets.
3. Public JSON/XML/CSV feeds.
4. JSON-LD and other structured HTML data.
5. Public HTML pages.

Avoid browser automation unless necessary.

Do not bypass authentication, CAPTCHAs, access controls, or rate limits.

Respect source terms, robots.txt, and reasonable request frequencies.

### Reusable adapters

Build adapters for shared registration platforms, not individual institutions.

Institution-specific configuration should be separate from platform-specific extraction logic.

A new institution using an already supported platform should ideally require only configuration.

Adapters must support:

- Fetching records.
- Pagination.
- Parsing.
- Validation.
- Normalization.
- Error reporting.

Use explicit, typed interfaces.

Do not introduce a plugin framework or dynamic loading system unless clearly necessary.

### Deterministic extraction

Production ingestion must not depend on LLMs.

Use:

- APIs.
- Structured parsing.
- Schema validation.
- Explicit mapping tables.
- Deterministic classification rules.

Never infer unknown dates, prices, locations, or availability.

Store unknown values as `null` or another explicit unknown representation.

### Idempotency

Running an importer multiple times with unchanged source data must not create duplicate records.

Use stable external identifiers when available.

Otherwise, use documented deterministic identity rules.

Keep source identifiers and canonical URLs.

Use transactions where supported and appropriate.

### Failure handling

- Use bounded concurrency.
- Apply network timeouts.
- Retry transient failures with backoff.
- Respect HTTP 429 responses.
- Record ingestion failures.
- Preserve previously imported data when a source fails.
- Do not mark records stale after an unsuccessful ingestion.
- Never delete records solely because they were missing from one incomplete fetch.

Stale-record handling must be conservative and explainable.

### Provenance

Every published course edition must be traceable to its source.

Store:

- Source identifier.
- Official URL.
- External record identifier, if available.
- First-seen timestamp.
- Last-seen timestamp.
- Last-successfully-verified timestamp.
- Content hash where useful.

Never present inferred availability as confirmed availability.

## 6. Domain modeling

Distinguish between:

- Institution: the organization offering courses.
- Course: the reusable learning activity.
- Course edition: a specific scheduled offering.
- Schedule: individual or recurring sessions.
- Source: an external data provider or listing.
- Source record: the original external representation.

A course may have multiple editions.

An edition may have multiple scheduled sessions.

Different sources may refer to the same course or edition.

Do not collapse these concepts into one database table merely for convenience.

Use explicit database constraints and indexes.

Preserve manually reviewed corrections across future imports.

Prefer UTC for stored timestamps and IANA time zones for local scheduling.

Do not treat local dates or recurring wall-clock times as UTC timestamps.

Handle daylight saving time correctly.

## 7. Database rules

Cloudflare D1 is the canonical persistent store.

- Use versioned migrations.
- Never modify an applied migration.
- Add new migrations for schema changes.
- Enable and respect foreign-key constraints.
- Use parameterized queries.
- Avoid N+1 queries.
- Add indexes based on real query patterns.
- Paginate potentially large results.
- Avoid unbounded scans.
- Keep queries compatible with D1's supported SQLite features.

Do not assume a SQLite extension is supported without verifying it.

Prefer simple SQL over unnecessary ORM abstractions.

Do not run destructive migrations against production without approval.

## 8. Search and filtering

Search should remain fast, predictable, and inexpensive.

Prefer D1 indexed queries, cached responses, or a static search index.

Do not introduce external search infrastructure without explicit approval.

Search filters must be:

- Composable.
- Validated.
- Reflected in shareable URLs.
- Compatible with pagination.
- Accessible from keyboard navigation.

Do not load the entire database into the browser as the dataset grows.

Use server-side pagination or bounded search indexes when necessary.

## 9. Frontend conventions

Use Astro's server-rendered or statically generated HTML where appropriate.

Prefer:

- Semantic HTML.
- Native browser capabilities.
- Small, focused components.
- Progressive enhancement.
- Minimal client-side JavaScript.

Avoid unnecessary client-side state management.

### Design

The interface should be:

- Friendly.
- Clear.
- Accessible.
- Responsive.
- Community-oriented.
- Easy to use on mobile devices.

Prioritize search and course discovery over decorative elements.

Use consistent spacing, typography, and component patterns.

Do not add unnecessary animations.

Respect reduced-motion preferences.

### Accessibility

Target WCAG 2.2 AA.

Ensure:

- Keyboard navigation.
- Visible focus indicators.
- Proper labels.
- Sufficient color contrast.
- Accessible validation errors.
- Semantic headings.
- Screen-reader-friendly controls.

Do not use color alone to communicate important information.

## 10. Localization

Spanish (`es`) is the default locale.

Catalan (`ca`) is supported from the beginning.

All user-facing interface strings must be localized.

Do not hardcode interface text inside components when it belongs in translation dictionaries.

Use locale-aware formatting for dates, times, numbers, and currency.

Keep source course titles and descriptions in their original language unless verified translations exist.

Do not confuse course language with interface language.

Design localization so additional languages can be added without major architectural changes.

## 11. SEO

Course pages should be indexable without client-side JavaScript.

Implement:

- Descriptive URLs.
- Unique page titles.
- Meta descriptions.
- Canonical URLs.
- Sitemaps.
- Appropriate `hreflang`.
- Structured data when supported by the actual content.
- Correct handling of expired editions.

Do not fabricate ratings, reviews, prices, or availability in structured data.

Avoid duplicate indexed pages for equivalent course editions.

## 12. Security and privacy

UrbanLabs should collect as little personal data as possible.

- Do not add tracking cookies.
- Do not add advertising trackers.
- Do not require accounts for public browsing.
- Do not log unnecessary personal information.
- Never commit secrets.
- Validate all untrusted input.
- Use parameterized SQL.
- Escape or sanitize external HTML.
- Protect administrative routes and actions.
- Verify authorization server-side.
- Use Turnstile for public submission forms where appropriate.

Treat external course descriptions as untrusted content.

Never execute scripts or embedded HTML from source websites.

Do not fetch arbitrary user-submitted URLs without SSRF protections. Prefer storing submissions for review and restricting automated fetching to approved sources.

## 13. Cloudflare Free plan constraints

Cloudflare Free compatibility is a core architectural requirement.

Before implementing resource-intensive functionality, verify current limits for:

- Worker requests.
- CPU time.
- Subrequests.
- Cron Triggers.
- D1 reads and writes.
- D1 storage.
- Build and deployment quotas.

Avoid designs that require paid Workers features.

Keep ingestion workloads bounded.

Use caching where appropriate.

Do not introduce R2, KV, Queues, Durable Objects, or other services unless there is a demonstrated need.

Use GitHub Actions for ingestion workloads that cannot reliably execute within the free Workers runtime, subject to GitHub's applicable limits.

## 14. Testing requirements

Every nontrivial change should include appropriate tests.

### Unit tests

Cover:

- Date normalization.
- Schedule parsing.
- Price parsing.
- Validation.
- Deduplication.
- Category mapping.
- Source identity generation.

### Integration tests

Cover:

- Database migrations.
- Query behavior.
- Importer persistence.
- Idempotency.
- Failed ingestion recovery.
- Manual correction preservation.

### End-to-end tests

Use Playwright for:

- Homepage.
- Course search.
- Filtering.
- Course details.
- Institution pages.
- Language switching.
- Mobile behavior.
- Community submissions.

Use saved source fixtures in CI.

Do not make routine tests depend on live third-party websites.

Live ingestion smoke tests should be explicitly separated from deterministic tests.

Never weaken or delete a failing test merely to make CI pass.

## 15. Code quality

Use strict TypeScript.

Avoid `any` unless justified and documented.

Validate external data at runtime.

Prefer small, pure functions for normalization and parsing.

Use meaningful names.

Avoid premature abstractions.

Do not add dependencies for trivial functionality.

Handle errors explicitly.

Do not silently swallow exceptions.

Use structured logs for ingestion and operational errors.

Keep comments focused on why something is implemented, not obvious behavior.

Do not perform unrelated refactoring while implementing a focused task.

## 16. Documentation

Keep documentation synchronized with implementation.

Important files:

- `README.md`: project overview and local setup.
- `AGENTS.md`: persistent agent instructions.
- `CONTRIBUTING.md`: contribution guidelines.
- `docs/architecture.md`: system architecture.
- `docs/data-sources.md`: researched source platforms.
- `docs/ingestion.md`: ingestion design and adapter development.
- `docs/database.md`: schema and migration guidance.
- `docs/deployment.md`: Cloudflare deployment instructions.
- `docs/adr/`: architecture decisions.

Document meaningful tradeoffs using Architecture Decision Records.

Do not claim a feature is complete when it is only scaffolded or mocked.

## 17. Git and change management

- Keep commits focused.
- Use descriptive commit messages.
- Avoid committing generated build artifacts.
- Do not commit credentials or local database files.
- Do not rewrite Git history without approval.
- Do not force-push without approval.
- Do not modify unrelated files unnecessarily.

Before completing a task:

1. Run formatting and lint checks.
2. Run TypeScript checks.
3. Run relevant unit and integration tests.
4. Run the production build when applicable.
5. Run relevant E2E tests when practical.
6. Review the diff for unintended changes.
7. Summarize what changed and what remains incomplete.

If a command cannot run, explain why.

Never report tests as passing unless they were actually executed successfully.

## 18. Definition of done

A feature is complete only when:

- It works as intended.
- It follows existing architectural conventions.
- External data is validated.
- Error conditions are handled.
- Appropriate tests exist and pass.
- Accessibility has been considered.
- Documentation is updated where necessary.
- It does not require unapproved paid infrastructure.
- It does not introduce unnecessary complexity.

For ingestion-related features, additionally require:

- Real source behavior has been verified.
- The adapter is idempotent.
- Source attribution is preserved.
- Failure recovery is tested.
- No fictional data is published.

## 19. Agent response format

When finishing a substantial task, report:

### Implemented

Briefly describe the completed functionality.

### Verification

List the commands executed and their results.

### Limitations

Identify any incomplete work, unverified assumptions, or external blockers.

### Next steps

Recommend the smallest logical next task.

Be concise and factual.

Do not claim production readiness unless the relevant acceptance criteria have been verified.

## 20. Final priorities

When requirements conflict, prioritize:

1. Security and legal compliance.
2. Data correctness and source provenance.
3. Reliability and failure recovery.
4. Cloudflare Free plan compatibility.
5. Maintainability and simplicity.
6. Accessibility and usability.
7. Performance.
8. Visual polish.

**The guiding principle: UrbanLabs should be a trustworthy, low-cost, community-maintained directory of real learning opportunities—not a visually impressive website filled with unreliable data.**
