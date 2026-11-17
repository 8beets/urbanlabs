import { describe, expect, it } from 'vitest';
import { createSnapshotCache } from '../../src/lib/ingestion/shared-snapshot';
import { retryDelayMs } from '../../src/lib/ingestion/http';
import { plainText } from '../../src/lib/ingestion/normalization/html';

describe('shared snapshot cache', () => {
  it('shares one read per key until it is an hour old', async () => {
    let now = 0;
    let reads = 0;
    const cache = createSnapshotCache<number>();
    const get = (key = '') =>
      cache(
        {},
        async () => ++reads,
        key,
        () => now,
      );
    expect(await Promise.all([get(), get()])).toEqual([1, 1]);
    now = 60 * 60 * 1000;
    expect(await get()).toBe(1);
    now += 1;
    expect(await get()).toBe(2);
    expect(await get('2027')).toBe(3);
  });

  it('drops a failed read so the next source tries again', async () => {
    let calls = 0;
    const cache = createSnapshotCache<string>();
    const read = async () => {
      if (++calls === 1) throw new Error('offline');
      return 'ok';
    };
    await expect(cache({}, read)).rejects.toThrow('offline');
    expect(await cache({}, read)).toBe('ok');
  });

  it('never caches for injected fetchers (tests)', async () => {
    let reads = 0;
    const cache = createSnapshotCache<number>();
    const options = { fetch: globalThis.fetch };
    await cache(options, async () => ++reads);
    expect(await cache(options, async () => ++reads)).toBe(2);
  });
});

describe('retry delay', () => {
  const now = Date.parse('2026-11-17T10:00:00Z');
  it('follows Retry-After in seconds or as an HTTP date', () => {
    expect(retryDelayMs('5', 1, now)).toBe(5000);
    expect(retryDelayMs(' 0 ', 1, now)).toBe(0);
    expect(retryDelayMs('Tue, 17 Nov 2026 10:00:30 GMT', 1, now)).toBe(30000);
    expect(retryDelayMs('Tue, 17 Nov 2026 09:59:00 GMT', 1, now)).toBe(0);
  });

  it('backs off exponentially without a usable header', () => {
    expect(retryDelayMs(null, 1, now)).toBe(2000);
    expect(retryDelayMs('soon', 2, now)).toBe(4000);
    expect(retryDelayMs('-3', 0, now)).toBe(1000);
  });
});

describe('plain text', () => {
  it('drops tags, decodes entities and collapses whitespace', () => {
    expect(plainText('<b>Taller</b>&nbsp;de&#32;cer&agrave;mica<br>  1')).toBe(
      'Taller de ceràmica 1',
    );
  });
});
