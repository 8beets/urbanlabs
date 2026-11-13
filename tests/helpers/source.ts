import { existsSync, readFileSync } from 'node:fs';
import type { FetchOptions } from '../../src/lib/ingestion/http';

/** A saved source page or response from tests/fixtures (file name with extension). */
export const readFixture = (file: string) =>
  readFileSync(new URL(`../fixtures/${file}`, import.meta.url), 'utf8');

/** A body (200), a full Response, or null/undefined for a 404. */
type Reply = string | Response | null | undefined;

/**
 * Fetch options for an adapter that answer from `respond` without waiting, so tests
 * never reach the network. `requests` lists every requested URL in order.
 */
export function fakeSource(respond: (url: URL, init?: RequestInit) => Reply) {
  const requests: string[] = [];
  const options: FetchOptions = {
    intervalMs: 0,
    sleep: async () => {},
    fetch: async (input, init) => {
      requests.push(String(input));
      const reply = respond(new URL(String(input)), init);
      if (reply instanceof Response) return reply;
      return reply == null
        ? new Response('', { status: 404 })
        : new Response(reply);
    },
  };
  return { options, requests };
}

/** A URL's path and query, e.g. "/robots.txt" or "/guia?page=1". */
export const pathOf = (url: string) => {
  const { pathname, search } = new URL(url);
  return pathname + search;
};

/** Whether tests/fixtures has a saved page with this file name. */
export const existsFixture = (file: string) =>
  existsSync(new URL(`../fixtures/${file}`, import.meta.url));
