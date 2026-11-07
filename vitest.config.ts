import { getViteConfig } from 'astro/config';
import astroConfig from './astro.config.mjs';

export default getViteConfig(
  {
    test: {
      include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
      testTimeout: 30000,
      hookTimeout: 30000,
    },
  },
  {
    // Resolve Astro's virtual modules without starting the Workers runtime.
    configFile: false,
    i18n: astroConfig.i18n,
  },
);
