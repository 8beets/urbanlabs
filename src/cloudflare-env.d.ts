// The Astro Cloudflare adapter always adds the static assets binding to the Worker
// (dist/server/wrangler.json); wrangler.jsonc leaves it to the adapter.
declare namespace Cloudflare {
  interface Env {
    ASSETS: Fetcher;
  }
}
