import type { APIRoute, GetStaticPaths } from 'astro';
import { loadCities, searchIndexes } from '../../../lib/catalog/pages';

// Prerendered to /search/<city>/archive.json; see src/lib/catalog/search-index.ts.
export const getStaticPaths = (() =>
  loadCities().map(({ city }) => ({
    params: { city: city.id },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params }) =>
  new Response(JSON.stringify(searchIndexes(params.city!).archive), {
    headers: { 'Content-Type': 'application/json' },
  });
