# Cache policy

Public course discovery and centre pages use the Cloudflare Workers Cache API for up to five minutes. A hit returns the rendered HTML without repeating D1 queries. The complete URL is the cache key, including the language, filters, pagination, and extra parameters preserved in links.

The browser receives `Cache-Control: public, max-age=0, s-maxage=300, must-revalidate`. Browsers must revalidate before reuse; the shared cache may reuse a response for 300 seconds. An explicit request with `Cache-Control: no-cache` or `max-age=0` skips the cached copy and replaces it with a fresh successful response. A request with `no-store` skips both reading and writing.

Only successful HTML responses on `/es/`, `/ca/`, their localized search routes (`/es/buscar`, `/ca/cerca`), and centre routes are eligible. Requests with cookies or authorization, non-GET requests, error responses, responses that set cookies (including through Astro), responses with `Vary`, and responses marked private or uncacheable use `no-store`. Other routes and legacy redirects are outside this policy. Cache read or write failures are logged and do not prevent the page from loading.

Cache writes run through `waitUntil`. The cache is local to each Cloudflare data centre; it is not a global application cache or a new paid service. Development skips Cache API reads and writes so local changes appear immediately. Workers Cache API operation on deployed hosts depends on Cloudflare's supported domain configuration; a custom domain is the intended deployment target.

Data imports, centre updates, and deployments do not purge this cache. Changes can take up to five minutes to appear on an ordinary request. No stale response is served after that TTL, including during a database outage. A future account, booking, or personalized page must remain outside the public route allowlist.

## Static assets

`public/_headers` gives images, fonts, and icons a one-hour browser TTL with `must-revalidate`. These paths have stable filenames, so they deliberately do not use `immutable`. Asset changes can take up to one hour to appear in a browser that already loaded them. Cloudflare's asset ETags remain available for conditional requests after expiry.

The Astro Cloudflare adapter adds the separate one-year immutable policy for content-hashed `/_astro/*` build assets. The custom rules leave that policy intact. `_headers` applies to Workers static assets, while middleware sets headers for server-rendered HTML. Astro's development asset server does not apply the production `_headers` rules.

References: [Cloudflare Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/), [Workers static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/), and [Astro middleware](https://docs.astro.build/en/guides/middleware/).
