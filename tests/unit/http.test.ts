import { describe, expect, it } from 'vitest';
import { createSourceFetcher, USER_AGENT } from '../../src/lib/ingestion/http';
import packageJson from '../../package.json' with { type: 'json' };

describe('source requests', () => {
  it('identify UrbanLabs with its site and repository, never as a browser', async () => {
    const sent: (string | null)[] = [];
    const get = createSourceFetcher('https://example.org', {
      intervalMs: 0,
      sleep: async () => {},
      fetch: async (_input, init) => {
        sent.push(new Headers(init?.headers).get('user-agent'));
        return new Response('ok');
      },
    });
    await get('https://example.org/page');
    expect(sent).toEqual([USER_AGENT]);
    expect(USER_AGENT).toBe(
      `UrbanLabs/${packageJson.version} (+https://urbanlabs.fyi; https://github.com/8beets/urbanlabs)`,
    );
    expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(USER_AGENT).not.toMatch(/Mozilla|Chrome|Safari|AppleWebKit/);
  });
});
