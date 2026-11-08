const PAGE_CACHE_CONTROL = 'public, max-age=0, s-maxage=300, must-revalidate';
// The filter-options endpoint runs several D1 queries per call, so it shares the edge cache.
const PUBLIC_PAGE =
  /^\/(?:es\/(?:buscar\/?|centros(?:\/[a-z0-9-]+)?\/?)?|ca\/(?:cerca\/?|centres(?:\/[a-z0-9-]+)?\/?)?|api\/filters)$/;

interface PageCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<unknown>;
}

interface CacheOptions {
  cache?: PageCache;
  waitUntil: (promise: Promise<unknown>) => void;
  hasSetCookies: () => boolean;
}

function logCacheFailure(operation: 'read' | 'write') {
  console.error(JSON.stringify({ event: 'page_cache_failed', operation }));
}

export async function withPageCache(
  request: Request,
  next: () => Promise<Response>,
  { cache, waitUntil, hasSetCookies }: CacheOptions,
): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (!PUBLIC_PAGE.test(pathname)) return next();
  const isApi = pathname === '/api/filters';

  const requestControl = request.headers.get('Cache-Control') ?? '';
  const bypass =
    request.method !== 'GET' ||
    request.headers.has('Cookie') ||
    request.headers.has('Authorization') ||
    hasSetCookies() ||
    /\bno-store\b/i.test(requestControl);
  // Keep the complete URL: filters, pagination, locale and preserved parameters
  // all affect page content or the links in the rendered HTML.
  const key = new Request(request.url);
  const refresh = /\bno-cache\b|\bmax-age\s*=\s*0\b/i.test(requestControl);

  if (!bypass && !refresh && cache) {
    try {
      const cached = await cache.match(key);
      if (cached) return cached;
    } catch {
      logCacheFailure('read');
    }
  }

  const response = await next();
  const cacheable =
    !bypass &&
    response.status === 200 &&
    response.headers
      .get('Content-Type')
      ?.includes(isApi ? 'application/json' : 'text/html') &&
    !response.headers.has('Set-Cookie') &&
    !hasSetCookies() &&
    !response.headers.has('Vary') &&
    !/\b(?:private|no-store|no-cache)\b/i.test(
      response.headers.get('Cache-Control') ?? '',
    );
  const result = new Response(response.body, response);
  result.headers.set(
    'Cache-Control',
    cacheable ? PAGE_CACHE_CONTROL : 'no-store',
  );

  if (cacheable && cache) {
    waitUntil(
      cache.put(key, result.clone()).catch(() => logCacheFailure('write')),
    );
  }
  return result;
}
