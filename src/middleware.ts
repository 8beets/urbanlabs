import { defineMiddleware } from 'astro:middleware';
import { pageCachePolicy } from './lib/http/page-cache';

export const onRequest = defineMiddleware(async (context, next) => {
  const { cache, response } = pageCachePolicy({
    request: context.request,
    response: await next(),
    hasSetCookies: !context.cookies.headers().next().done,
  });
  // Astro turns these options into Cloudflare-CDN-Cache-Control after the render.
  // In development the cache is a no-op, so local changes appear immediately.
  if (cache !== null) context.cache.set(cache);
  return response;
});
