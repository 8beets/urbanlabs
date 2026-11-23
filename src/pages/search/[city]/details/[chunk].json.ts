import type { APIRoute, GetStaticPaths } from 'astro';
import { loadCities, searchIndexes } from '../../../../lib/catalog/pages';

// Prerendered to /search/<city>/details/<n>.json; see src/lib/catalog/search-index.ts.
export const getStaticPaths = (() =>
  loadCities().flatMap(({ city }) =>
    searchIndexes(city.id).details.map((_, chunk) => ({
      params: { city: city.id, chunk: String(chunk) },
    })),
  )) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params }) => {
  const chunk = searchIndexes(params.city!).details[Number(params.chunk)];
  if (!chunk) return new Response(null, { status: 404 });
  return new Response(JSON.stringify(chunk), {
    headers: { 'Content-Type': 'application/json' },
  });
};
