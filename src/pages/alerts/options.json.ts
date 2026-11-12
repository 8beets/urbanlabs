import type { APIRoute } from 'astro';
import { alertOptions } from '../../lib/catalog/pages';

// Prerendered to /alerts/options.json; see src/lib/alerts/options.ts.
export const GET: APIRoute = () =>
  new Response(JSON.stringify(alertOptions()), {
    headers: { 'Content-Type': 'application/json' },
  });
