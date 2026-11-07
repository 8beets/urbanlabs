import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { categoryLabel } from '../../i18n/ui';
import { parseFilters } from '../../lib/courses/discovery';
import {
  loadFilterOptions,
  type FilterOptions,
} from '../../lib/courses/filter-options';
import {
  loadGeography,
  reconcileGeography,
} from '../../lib/locations/geography';

export const GET: APIRoute = async ({ url }) => {
  const locale = url.searchParams.get('locale');
  const headers = { 'Cache-Control': 'no-store' };
  if (locale !== 'es' && locale !== 'ca')
    return new Response(null, { status: 400, headers });
  let filters;
  try {
    filters = parseFilters(url.searchParams);
  } catch {
    return new Response(null, { status: 400, headers });
  }
  try {
    const geography = await loadGeography(env.DB);
    try {
      reconcileGeography(filters, geography);
    } catch {
      return new Response(null, { status: 400, headers });
    }
    const options = await loadFilterOptions(
      env.DB,
      url.searchParams,
      geography,
    );
    const body: FilterOptions = {
      centre: options.centre,
      centres: options.centres.map((row) => ({
        value: row.id,
        label: row.name,
      })),
      categories: options.categories.map((value) => ({
        value,
        label: categoryLabel(value, locale),
      })),
    };
    return Response.json(body, {
      headers: { 'Cache-Control': 'public, max-age=60' },
    });
  } catch {
    console.error(JSON.stringify({ event: 'filter_options_unavailable' }));
    return new Response(null, { status: 503, headers });
  }
};
