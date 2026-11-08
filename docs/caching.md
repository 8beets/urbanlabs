# Cache policy

Public course discovery, centre pages and `/api/filters` use Astro route caching with the Cloudflare provider (`cacheCloudflare()` from `@astrojs/cloudflare/cache`, experimental). `src/middleware.ts` calls `context.cache.set({ maxAge: 300, swr: 60 })` for eligible responses; Astro turns that into `Cloudflare-CDN-Cache-Control` and `Cache-Tag` headers, and Cloudflare's Workers Cache serves hits in front of the Worker, so a hit runs no code and no D1 queries. Responses may be served stale for up to 60 seconds while they revalidate. The complete URL is the cache key, including the language, filters, pagination, and extra parameters preserved in links.

The browser receives `Cache-Control: public, max-age=0, must-revalidate`, so it always revalidates against the edge cache. The adapter marks every response without cache intent `Cloudflare-CDN-Cache-Control: no-store`.

Only successful HTML responses on `/es`, `/ca`, their localized search routes (`/es/buscar`, `/ca/cerca`), and centre routes, plus the JSON from `/api/filters`, are eligible (`src/lib/http/page-cache.ts`). Requests with cookies or authorization or `no-store`, non-GET requests, error responses, responses that set cookies (including through Astro), responses with `Vary`, and responses marked private or uncacheable opt out and receive `no-store`. Other routes and legacy redirects are outside this policy.

The Workers Cache works on custom domains (production is `urbanlabs.fyi`), not on `workers.dev`. Development uses a no-op cache so local changes appear immediately; test caching with a build and preview.

Data imports and centre updates do not purge this cache, so changes can take up to five minutes (plus the stale window) to appear. Responses are tagged with their path and Worker version, so `context.cache.invalidate({ path | tags })` can purge them later. A future account, booking, or personalized page must remain outside the public route allowlist.

## Static assets

`public/_headers` gives images, fonts, and icons a one-hour browser TTL with `must-revalidate`. These paths have stable filenames, so they deliberately do not use `immutable`. Asset changes can take up to one hour to appear in a browser that already loaded them. Cloudflare's asset ETags remain available for conditional requests after expiry.

The Astro Cloudflare adapter adds the separate one-year immutable policy for content-hashed `/_astro/*` build assets. The custom rules leave that policy intact. `_headers` applies to Workers static assets, while middleware sets headers for server-rendered HTML. Astro's development asset server does not apply the production `_headers` rules.

References: [Astro route caching](https://docs.astro.build/en/guides/caching/), [Cloudflare Workers Cache](https://developers.cloudflare.com/workers/cache/), [Workers static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/), and [Astro middleware](https://docs.astro.build/en/guides/middleware/).
