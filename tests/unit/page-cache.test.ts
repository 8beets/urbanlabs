import { describe, expect, it } from 'vitest';
import {
  PAGE_CACHE_OPTIONS,
  pageCachePolicy,
} from '../../src/lib/http/page-cache';

function policy(
  path: string,
  {
    init,
    headers = { 'Content-Type': 'text/html; charset=utf-8' },
    status = 200,
    hasSetCookies = false,
  }: {
    init?: RequestInit;
    headers?: Record<string, string>;
    status?: number;
    hasSetCookies?: boolean;
  } = {},
) {
  return pageCachePolicy({
    request: new Request(`https://urbanlabs.fyi${path}`, init),
    response: new Response('Courses', { status, headers }),
    hasSetCookies,
  });
}

describe('public page cache policy', () => {
  it.each([
    '/es',
    '/es/',
    '/ca/',
    '/es/?q=yoga',
    '/es/buscar?q=yoga&page=2',
    '/ca/cerca?category=BALL',
    '/es/centros',
    '/ca/centres',
    '/es/centros/sant-andreu',
    '/ca/centres/sant-andreu',
  ])('lets the CDN store %s', (path) => {
    const result = policy(path);
    expect(result.cache).toEqual(PAGE_CACHE_OPTIONS);
    expect(result.response.headers.get('Cache-Control')).toBe(
      'public, max-age=0, must-revalidate',
    );
  });

  it('shares filter options JSON but not JSON from a page route', () => {
    const json = { 'Content-Type': 'application/json' };
    expect(policy('/api/filters?locale=es', { headers: json }).cache).toEqual(
      PAGE_CACHE_OPTIONS,
    );
    expect(policy('/es/', { headers: json }).cache).toBe(false);
  });

  it.each([400, 404, 503])('does not store an HTTP %i response', (status) => {
    const result = policy('/es/', { status });
    expect(result.cache).toBe(false);
    expect(result.response.headers.get('Cache-Control')).toBe('no-store');
    expect(result.response.status).toBe(status);
  });

  it.each([
    ['Cookie', 'session=private'],
    ['Authorization', 'Bearer private'],
    ['Cache-Control', 'no-store'],
  ])('does not store responses to requests with %s', (name, value) => {
    const result = policy('/es/', { init: { headers: { [name]: value } } });
    expect(result.cache).toBe(false);
    expect(result.response.headers.get('Cache-Control')).toBe('no-store');
  });

  it.each([
    ['Set-Cookie', 'session=private'],
    ['Vary', 'Accept-Language'],
    ['Cache-Control', 'private'],
    ['Cache-Control', 'no-store'],
    ['Cache-Control', 'no-cache'],
  ])('does not store responses with %s: %s', (name, value) => {
    const result = policy('/es/', {
      headers: { 'Content-Type': 'text/html', [name]: value },
    });
    expect(result.cache).toBe(false);
    expect(result.response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('does not store cookies set through Astro before the adapter adds headers', () => {
    expect(policy('/es/', { hasSetCookies: true }).cache).toBe(false);
  });

  it('does not store non-GET requests', () => {
    expect(policy('/es/', { init: { method: 'POST' } }).cache).toBe(false);
  });

  it('leaves redirects and routes outside the public list unchanged', () => {
    const redirect = policy('/', {
      status: 308,
      headers: { Location: '/es/' },
    });
    expect(redirect.cache).toBeNull();
    expect(redirect.response.headers.get('Cache-Control')).toBeNull();
    expect(policy('/admin').cache).toBeNull();
  });
});
