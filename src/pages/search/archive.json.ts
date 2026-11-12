import type { APIRoute } from 'astro';
import { searchIndexes } from '../../lib/catalog/pages';

// Prerendered to /search/archive.json; see src/lib/catalog/search-index.ts.
export const GET: APIRoute = () =>
  new Response(JSON.stringify(searchIndexes().archive), {
    headers: { 'Content-Type': 'application/json' },
  });
