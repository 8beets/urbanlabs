# ADR 0003: Compile translations with Paraglide

Status: accepted

## Context

Issue #62 requests Paraglide for translations. Interface strings, category names,
reviewed geographic labels, and schedule vocabulary were spread across TypeScript
maps. Astro already owns Spanish and Catalan routes, and public browsing does not
need preference cookies or browser-language detection.

## Decision

Keep all translated text in `messages/es.json` and `messages/ca.json`. Use the
Paraglide Vite plugin for development/builds and its CLI before type checks and
tests. Share compiler options in `paraglide.config.mjs`. Install the message-format
plugin locally through npm and the lockfile to support offline compilation.

Pass the existing route/API locale explicitly to generated message functions.
Keep Astro's i18n routing and native `Intl` formatting. No Paraglide middleware or
mutable global locale is required. Browser enhancements receive localized strings
from HTML attributes. Unknown source content remains unchanged.

## Consequences

Translation catalogs are editable independently of TypeScript, with generated
message types and regression checks for complete Spanish/Catalan catalogs.
Generated files are ignored and must be compiled on fresh checkouts. Every new
message needs both locales; every call needs its explicit locale to preserve SSR
and API behavior. Paraglide and its format plugin add development dependencies,
without adding hosted services or browser catalog downloads.
