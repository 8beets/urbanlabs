import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TtlMemo } from '../../src/lib/cache/ttl-memo';

describe('TtlMemo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reuses a value until it expires, then loads again', async () => {
    const memo = new TtlMemo<number>(1000, 10);
    const scope = {};
    const load = vi.fn(async () => load.mock.calls.length);
    expect(await memo.get(scope, 'k', load)).toBe(1);
    vi.advanceTimersByTime(999);
    expect(await memo.get(scope, 'k', load)).toBe(1);
    vi.advanceTimersByTime(2);
    expect(await memo.get(scope, 'k', load)).toBe(2);
  });

  it('shares one in-flight load between concurrent callers', async () => {
    const memo = new TtlMemo<string>(1000, 10);
    const scope = {};
    const load = vi.fn(async () => 'value');
    const results = await Promise.all([
      memo.get(scope, 'k', load),
      memo.get(scope, 'k', load),
      memo.get(scope, 'k', load),
    ]);
    expect(results).toEqual(['value', 'value', 'value']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('does not keep failures', async () => {
    const memo = new TtlMemo<string>(1000, 10);
    const scope = {};
    await expect(
      memo.get(scope, 'k', async () => {
        throw new Error('D1 unavailable');
      }),
    ).rejects.toThrow('D1 unavailable');
    expect(await memo.get(scope, 'k', async () => 'recovered')).toBe(
      'recovered',
    );
  });

  it('keeps scopes separate and clears one scope', async () => {
    const memo = new TtlMemo<string>(1000, 10);
    const [a, b] = [{}, {}];
    await memo.get(a, 'k', async () => 'a');
    await memo.get(b, 'k', async () => 'b');
    memo.clear(a);
    expect(await memo.get(a, 'k', async () => 'a2')).toBe('a2');
    expect(await memo.get(b, 'k', async () => 'b2')).toBe('b');
  });

  it('stays bounded by evicting the oldest keys', async () => {
    const memo = new TtlMemo<string>(1000, 2);
    const scope = {};
    await memo.get(scope, '1', async () => 'one');
    await memo.get(scope, '2', async () => 'two');
    await memo.get(scope, '3', async () => 'three');
    expect(await memo.get(scope, '1', async () => 'one again')).toBe(
      'one again',
    );
    expect(await memo.get(scope, '3', async () => 'unused')).toBe('three');
  });
});
