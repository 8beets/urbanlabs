import { afterEach, describe, expect, it, vi } from 'vitest';
import { withPageCache } from '../../src/lib/http/page-cache';

function harness() {
  const entries = new Map<string, Response>();
  const pending: Promise<unknown>[] = [];
  const cache = {
    match: vi.fn(async (request: Request) => entries.get(request.url)?.clone()),
    put: vi.fn(async (request: Request, response: Response) => {
      entries.set(request.url, response.clone());
    }),
  };
  const next = vi.fn(
    async () =>
      new Response('Courses version 1', {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
  );
  const options = {
    cache,
    waitUntil: (promise: Promise<unknown>) => {
      pending.push(promise);
    },
    hasSetCookies: vi.fn(() => false),
  };
  async function fetch(path = '/es/', init?: RequestInit) {
    const response = await withPageCache(
      new Request(`https://urbanlabs.fyi${path}`, init),
      next,
      options,
    );
    await Promise.all(pending);
    return response;
  }
  return { fetch, cache, next, options };
}

afterEach(() => vi.restoreAllMocks());

describe('public page cache', () => {
  it('reuses a public response without rendering or querying again', async () => {
    const { fetch, next } = harness();
    const first = await fetch();
    expect(first.headers.get('Cache-Control')).toBe(
      'public, max-age=0, s-maxage=300, must-revalidate',
    );
    expect(await first.text()).toBe('Courses version 1');
    expect(await (await fetch()).text()).toBe('Courses version 1');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('keeps languages, filters, pagination, centres and extra URL state separate', async () => {
    const { fetch, next } = harness();
    const paths = [
      '/es/',
      '/ca/',
      '/es/?q=yoga',
      '/es/buscar?q=yoga',
      '/ca/cerca?category=BALL',
      '/es/?q=music',
      '/es/?page=2',
      '/es/?category=BALL',
      '/es/?centre=cc-can-baste',
      '/es/?maxPrice=20',
      '/es/?region=catalunya',
      '/es/centros',
      '/ca/centres',
      '/es/centros/sant-andreu',
      '/es/centros/can-baste',
      '/ca/centres/sant-andreu',
    ];
    for (const path of paths) {
      next.mockImplementationOnce(
        async () =>
          new Response(path, { headers: { 'Content-Type': 'text/html' } }),
      );
      expect(await (await fetch(path)).text()).toBe(path);
    }
    for (const path of paths)
      expect(await (await fetch(path)).text()).toBe(path);
    expect(next).toHaveBeenCalledTimes(paths.length);
  });

  it.each([400, 404, 503])(
    'does not save an HTTP %i response',
    async (status) => {
      const { fetch, next, cache } = harness();
      next.mockImplementation(
        async () =>
          new Response('Error', {
            status,
            headers: { 'Content-Type': 'text/html' },
          }),
      );
      expect((await fetch()).headers.get('Cache-Control')).toBe('no-store');
      await fetch();
      expect(cache.put).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(2);
    },
  );

  it.each([
    ['Cookie', 'session=private'],
    ['Authorization', 'Bearer private'],
    ['Cache-Control', 'no-store'],
  ])(
    'bypasses an existing cache entry for private or no-store requests: %o',
    async (name, value) => {
      const { fetch, next, cache } = harness();
      await fetch();
      next.mockImplementationOnce(
        async () =>
          new Response('Private content', {
            headers: { 'Content-Type': 'text/html' },
          }),
      );
      const response = await fetch('/es/', { headers: { [name!]: value! } });
      expect(await response.text()).toBe('Private content');
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(cache.put).toHaveBeenCalledTimes(1);
      expect(await (await fetch()).text()).toBe('Courses version 1');
    },
  );

  it.each(['no-cache', 'max-age=0'])(
    'refreshes an existing entry for request %s',
    async (directive) => {
      const { fetch, next } = harness();
      await fetch();
      next.mockImplementationOnce(
        async () =>
          new Response('Updated courses', {
            headers: { 'Content-Type': 'text/html' },
          }),
      );
      expect(
        await (
          await fetch('/es/', { headers: { 'Cache-Control': directive } })
        ).text(),
      ).toBe('Updated courses');
      expect(await (await fetch()).text()).toBe('Updated courses');
      expect(next).toHaveBeenCalledTimes(2);
    },
  );

  it.each([
    ['Set-Cookie', 'session=private'],
    ['Vary', 'Accept-Language'],
    ['Cache-Control', 'private'],
    ['Cache-Control', 'no-store'],
    ['Cache-Control', 'no-cache'],
    ['Content-Type', 'application/json'],
  ])(
    'does not share responses with privacy or variant headers: %o',
    async (name, value) => {
      const { fetch, next, cache } = harness();
      next.mockImplementation(
        async () =>
          new Response('Private or variant content', {
            headers: { 'Content-Type': 'text/html', [name!]: value! },
          }),
      );
      expect((await fetch()).headers.get('Cache-Control')).toBe('no-store');
      expect(cache.put).not.toHaveBeenCalled();
    },
  );

  it('caches filter options JSON but not JSON served from a page route', async () => {
    const { fetch, next } = harness();
    next.mockImplementation(
      async () =>
        new Response('{}', { headers: { 'Content-Type': 'application/json' } }),
    );
    const path = '/api/filters?locale=es';
    expect((await fetch(path)).headers.get('Cache-Control')).toBe(
      'public, max-age=0, s-maxage=300, must-revalidate',
    );
    await fetch(path);
    expect(next).toHaveBeenCalledTimes(1);
    expect((await fetch('/es/')).headers.get('Cache-Control')).toBe('no-store');
  });

  it('does not save cookies set through Astro before the adapter adds response headers', async () => {
    const { fetch, options, cache, next } = harness();
    next.mockImplementationOnce(async () => {
      options.hasSetCookies.mockReturnValue(true);
      return new Response('Cookie content', {
        headers: { 'Content-Type': 'text/html' },
      });
    });
    expect((await fetch()).headers.get('Cache-Control')).toBe('no-store');
    expect(cache.put).not.toHaveBeenCalled();
  });

  it.each(['HEAD', 'POST'])(
    'does not read or populate the GET cache for %s',
    async (method) => {
      const { fetch, cache } = harness();
      expect(
        (await fetch('/es/', { method })).headers.get('Cache-Control'),
      ).toBe('no-store');
      expect(cache.match).not.toHaveBeenCalled();
      expect(cache.put).not.toHaveBeenCalled();
    },
  );

  it('leaves redirects and routes outside the public directory unchanged', async () => {
    const { fetch, next, cache } = harness();
    next.mockImplementation(
      async () =>
        new Response(null, { status: 308, headers: { Location: '/es/' } }),
    );
    const response = await fetch('/');
    expect(response.status).toBe(308);
    expect(response.headers.get('Cache-Control')).toBeNull();
    await fetch('/admin');
    expect(cache.match).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
  });

  it.each(['read', 'write'])(
    'serves the page when the cache %s fails',
    async (operation) => {
      const { fetch, cache } = harness();
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      if (operation === 'read')
        cache.match.mockRejectedValueOnce(new Error('Cache unavailable'));
      else cache.put.mockRejectedValueOnce(new Error('Cache full'));
      expect(await (await fetch()).text()).toBe('Courses version 1');
      expect(log).toHaveBeenCalledWith(
        JSON.stringify({ event: 'page_cache_failed', operation }),
      );
    },
  );
});
