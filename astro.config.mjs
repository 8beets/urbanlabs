import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import { cacheCloudflare } from '@astrojs/cloudflare/cache';
import tailwindcss from '@tailwindcss/vite';
import process from 'node:process';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import paraglideConfig from './paraglide.config.mjs';

export default defineConfig({
  output: 'server',
  i18n: {
    locales: ['es', 'ca'],
    defaultLocale: 'es',
    routing: {
      prefixDefaultLocale: true,
      // The root route preserves query strings with a permanent redirect.
      redirectToDefaultLocale: false,
    },
  },
  adapter: cloudflare({
    imageService: 'passthrough',
    ...(process.env.LEARNAPROP_E2E === '1'
      ? { persistState: { path: '.wrangler/e2e-state' } }
      : {}),
  }),
  cache: { provider: cacheCloudflare() },
  session: false,
  vite: { plugins: [tailwindcss(), paraglideVitePlugin(paraglideConfig)] },
});
