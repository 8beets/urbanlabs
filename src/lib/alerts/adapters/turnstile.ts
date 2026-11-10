const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Server-side Turnstile check (https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
 * Any network or parsing failure counts as "not verified".
 */
export async function verifyTurnstile(
  secret: string,
  token: string,
  remoteIp: string | null,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (!token || token.length > 2048) return false;
  const body = new FormData();
  body.set('secret', secret);
  body.set('response', token);
  if (remoteIp) body.set('remoteip', remoteIp);
  try {
    const response = await fetcher(SITEVERIFY, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return false;
    }
    const result: unknown = await response.json();
    return (
      typeof result === 'object' &&
      result !== null &&
      'success' in result &&
      result.success === true
    );
  } catch {
    return false;
  }
}
