import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import paraglideConfig from './paraglide.config.mjs';

// Pages are prerendered from the catalogue snapshot (docs/adr/0008-static-site.md).
// Only the alert pages and the 404 opt out with `prerender = false` and run on the
// Worker; everything else is served as static assets without invoking it.
export default defineConfig({
  output: 'static',
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
