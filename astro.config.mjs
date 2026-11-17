import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { URL } from 'node:url';
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import paraglideConfig from './paraglide.config.mjs';

// Pages are prerendered from the catalogue snapshot (docs/adr/0008-static-site.md).
// Only the alert pages and the 404 opt out with `prerender = false` and run on the
// Worker; everything else is served as static assets without invoking it.

// Pages that must not be in search results (they also carry noindex): alert sign-up and
// token pages, the 404, and the search JSON. robots.txt points crawlers at the sitemap.
const notIndexed = /\/(alertas|alertes|alerts|search)(\/|$)|\/404(\.html)?\/?$/;

export default defineConfig({
  // Canonical URLs, the sitemap and hreflang links are absolute on this origin.
  site: 'https://urbanlabs.fyi',
  output: 'static',
  integrations: [
    // hreflang pairs live in each page's <head>: the sitemap's own i18n option pairs
    // pages by swapping the locale prefix, which is wrong for translated slugs
    // (/es/proyecto ↔ /ca/projecte).
    sitemap({
      filter: (page) => !notIndexed.test(page),
      // Directory pages (index.astro → …/index.html) are served at their path with a
      // trailing slash, which is also their canonical; the sitemap drops it, so put it
      // back when the built page is a directory index.
      serialize: (item) => {
        const path = new URL(item.url).pathname;
        return !path.endsWith('/') &&
          existsSync(join('dist', 'client', path, 'index.html'))
          ? { ...item, url: `${item.url}/` }
          : item;
      },
    }),
  ],
  // `buscar.astro` → `buscar.html`, served at `/es/buscar` (no trailing-slash
  // redirect); `index.astro` stays `index.html`, served at `/es/`.
  build: { format: 'preserve' },
  i18n: {
    locales: ['es', 'ca'],
    defaultLocale: 'es',
    routing: {
      prefixDefaultLocale: true,
      // `/` is a static redirect in public/_redirects.
      redirectToDefaultLocale: false,
    },
  },
  adapter: cloudflare({
    imageService: 'passthrough',
    // Prerendering reads the snapshot file from disk, so it runs in Node.
    prerenderEnvironment: 'node',
  }),
  session: false,
  vite: { plugins: [tailwindcss(), paraglideVitePlugin(paraglideConfig)] },
});
