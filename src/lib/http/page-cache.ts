import type { CacheOptions } from 'astro';

// Shared (edge) freshness; stale copies may be served while Cloudflare revalidates.
export const PAGE_CACHE_OPTIONS: CacheOptions = { maxAge: 300, swr: 60 };
// Browsers always revalidate against the edge cache; only the CDN holds copies.
const BROWSER_CACHE_CONTROL = 'public, max-age=0, must-revalidate';

// The filter-options endpoint runs several D1 queries per call, so it shares the edge cache.
const PUBLIC_PAGE =
  /^\/(?:es(?:\/(?:buscar\/?|centros(?:\/[a-z0-9-]+)?\/?)?)?|ca(?:\/(?:cerca\/?|centres(?:\/[a-z0-9-]+)?\/?)?)?|api\/filters)$/;

interface PolicyInput {
  request: Request;
  response: Response;
  hasSetCookies: boolean;
}

export function isPublicPage(pathname: string): boolean {
  return PUBLIC_PAGE.test(pathname);
}

function isShareable({ request, response, hasSetCookies }: PolicyInput) {
  const { pathname } = new URL(request.url);
  const requestControl = request.headers.get('Cache-Control') ?? '';
  return (
    request.method === 'GET' &&
    !request.headers.has('Cookie') &&
    !request.headers.has('Authorization') &&
    !/\bno-store\b/i.test(requestControl) &&
    !hasSetCookies &&
    response.status === 200 &&
    Boolean(
      response.headers
        .get('Content-Type')
        ?.includes(
          pathname === '/api/filters' ? 'application/json' : 'text/html',
        ),
    ) &&
    !response.headers.has('Set-Cookie') &&
    !response.headers.has('Vary') &&
    !/\b(?:private|no-store|no-cache)\b/i.test(
      response.headers.get('Cache-Control') ?? '',
    )
  );
}

/**
 * Decides what the CDN cache provider may store for a response. Returns the
 * options to pass to `cache.set()` (or `false` to opt out) and the response to
 * send; outside the public allowlist the response is untouched.
 */
export function pageCachePolicy(input: PolicyInput): {
  cache: CacheOptions | false | null;
  response: Response;
} {
  if (!isPublicPage(new URL(input.request.url).pathname))
    return { cache: null, response: input.response };
  const shareable = isShareable(input);
  const response = new Response(input.response.body, input.response);
  response.headers.set(
    'Cache-Control',
    shareable ? BROWSER_CACHE_CONTROL : 'no-store',
  );
  return { cache: shareable ? PAGE_CACHE_OPTIONS : false, response };
}
