# Cache policy

Public pages are static files built from a catalogue snapshot
([ADR 0008](adr/0008-static-site.md)). Cloudflare serves them as Workers static
assets, without invoking the Worker or reading D1, so there is no request-time page
cache to manage. The former Astro route cache (`cacheCloudflare()`), its middleware
and the `/api/filters` endpoint were removed.

## Freshness

Pages and the search index change only when a new build is deployed: after every
ingestion run, daily just after midnight in Madrid, and on pushes to `main`
(`.github/workflows/deploy.yml`). Between builds, prerendered course cards that have
since ended are hidden in the browser (`src/components/ExpiredCards.astro`) and the
browser search recomputes liveness with the current date.

## Browser caching

`public/_headers` gives prerendered pages (`/es/*`, `/ca/*`) and the search index
(`/search/*`) `Cache-Control: public, max-age=0, must-revalidate`: browsers keep a copy
but revalidate it with the asset ETag, so a new deployment is visible immediately.

Images, fonts and icons have a one-hour browser TTL with `must-revalidate`; their
filenames are stable, so they deliberately do not use `immutable`. The Astro
Cloudflare adapter adds a one-year immutable policy for content-hashed `/_astro/*`
build assets.

## On-demand pages

Only the alert pages and the 404 page run on the Worker. Alert pages send
`Cache-Control: no-store` and keep tokens out of `Referer` headers. Inside the Worker,
reference lookups used by the alert form (geography, the live-cutoff time zones) are
memoized per isolate for five minutes (`src/lib/cache/ttl-memo.ts`).

References: [Workers static assets](https://developers.cloudflare.com/workers/static-assets/),
[static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/)
and [redirects](https://developers.cloudflare.com/workers/static-assets/redirects/).
