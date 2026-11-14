export interface FetchOptions {
  fetch?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  intervalMs?: number;
  /** Keep the session cookies the source sets and send them back (Girona's listing). */
  session?: boolean;
  /** Response size limit in bytes (default 2 MB), for whole-dataset downloads. */
  maxBytes?: number;
}

export const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export function createSourceFetcher(
  origin: string,
  options: FetchOptions = {},
) {
  const fetcher = options.fetch ?? fetch;
  const pause = options.sleep ?? sleep;
  const cookies = new Map<string, string>();
  return async (url: string, allowNotFound = false): Promise<string | null> => {
    if (new URL(url).origin !== origin || new URL(url).protocol !== 'https:')
      throw new Error('Source URL outside approved origin');
    for (let attempt = 0; attempt < 3; attempt++) {
      await pause(options.intervalMs ?? 1000);
      let response: Response;
      try {
        response = await fetcher(url, {
          signal: AbortSignal.timeout(15000),
          redirect: 'error',
          headers: {
            'User-Agent': 'LearnAprop/0.1 (local course metadata research)',
            Accept: 'text/html,text/plain;q=0.9',
            ...(cookies.size
              ? {
                  Cookie: [...cookies]
                    .map(([name, value]) => `${name}=${value}`)
                    .join('; '),
                }
              : {}),
          },
        });
      } catch (error) {
        if (attempt === 2) throw error;
        await pause(1000 * 2 ** attempt);
        continue;
      }
      if (options.session)
        for (const cookie of response.headers.getSetCookie()) {
          const pair = cookie.split(';', 1)[0]!;
          const split = pair.indexOf('=');
          if (split > 0)
            cookies.set(pair.slice(0, split).trim(), pair.slice(split + 1));
        }
      if (response.status === 404 && allowNotFound) {
        await response.body?.cancel();
        return null;
      }
      if (response.status === 429 || response.status >= 500) {
        await response.body?.cancel();
        const retryAfter = response.headers.get('retry-after');
        const delay =
          retryAfter === null
            ? 1000 * 2 ** attempt
            : /^\d+$/.test(retryAfter)
              ? Number(retryAfter) * 1000
              : Math.max(0, Date.parse(retryAfter) - Date.now());
        if (attempt === 2 || !Number.isFinite(delay) || delay > 60000)
          throw new Error(`Source HTTP ${response.status}; retry later`);
        await pause(delay);
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`Source HTTP ${response.status}`);
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Empty response body');
      const limit = options.maxBytes ?? 2_000_000;
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > limit)
            throw new Error(
              `Source page exceeds ${limit / 1_000_000} MB limit`,
            );
          chunks.push(value);
        }
      } finally {
        await reader.cancel();
      }
      return new Blob(chunks).text();
    }
    throw new Error('Source retries exhausted');
  };
}
