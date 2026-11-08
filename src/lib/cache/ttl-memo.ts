interface Entry<V> {
  expires: number;
  value: Promise<V>;
}

/**
 * Short-lived per-isolate memo for read-mostly D1 lookups. Each scope (normally the
 * D1 binding) has its own bounded set of keys. Concurrent callers share one
 * in-flight load, and failed loads are never kept. Entries expire quickly because
 * ingestion has no way to purge an isolate's memory.
 */
export class TtlMemo<V> {
  readonly #scopes = new WeakMap<object, Map<string, Entry<V>>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
  ) {}

  get(scope: object, key: string, load: () => Promise<V>): Promise<V> {
    let entries = this.#scopes.get(scope);
    if (!entries) {
      entries = new Map();
      this.#scopes.set(scope, entries);
    }
    const now = Date.now();
    const cached = entries.get(key);
    if (cached && cached.expires > now) return cached.value;
    entries.delete(key);
    // Drop the oldest entries first (Map keeps insertion order) to stay bounded.
    while (entries.size >= this.maxEntries) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) break;
      entries.delete(oldest);
    }
    const value = load();
    entries.set(key, { expires: now + this.ttlMs, value });
    const forget = () => {
      if (entries.get(key)?.value === value) entries.delete(key);
    };
    value.catch(forget);
    return value;
  }

  clear(scope: object): void {
    this.#scopes.delete(scope);
  }
}
