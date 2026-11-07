# Contributing

Read [AGENTS.md](AGENTS.md) and follow the [local setup](README.md#local-setup). Use small, focused changes and strict TypeScript. Do not publish fictional courses, add paid services, or deploy without approval.

Run formatting, linting, type checking, applicable tests, and the production build before submitting a change. Include D1 runtime tests for persistence changes on a supported host. Report checks that could not run.

Keep saved source fixtures limited to the data needed for deterministic tests. Label synthetic fixtures explicitly and never import them into public discovery. Live network smoke tests belong outside routine CI.

Use new versioned migrations for schema changes; never edit a migration after it has been applied to a shared environment. Do not commit local databases, secrets, generated build output, or browser artifacts.

Record meaningful architecture decisions in `docs/adr/`. Source integrations must document access policies, provenance, limitations, and how their real behavior was verified.

## Translations

Edit `messages/es.json` and `messages/ca.json` for all translated text, including
interface labels, accessibility messages, category names, reviewed place names,
and recognized schedule terms. Keep the same keys in both files. Source titles,
descriptions, institution names, and unknown labels stay in their original language.

Run `npm run i18n:compile` to generate typed Paraglide messages. Development and
builds compile automatically through the Vite plugin; type checking and tests also
compile first. Generated `src/paraglide/` files are ignored and must not be committed.
The format plugin is installed through the lockfile, so compilation needs no CDN.

Call messages with the route or API locale explicitly, for example
`m.searchTitle({}, { locale })`. This keeps SSR and concurrent requests isolated
without cookies or global locale state. Browser enhancements receive translated
labels from server-rendered attributes. Keep `astro:i18n` for links and routing.

When adding a locale, update `project.inlang/settings.json` and the Astro routing
configuration, add the matching catalog and pages, then run the full checks.
