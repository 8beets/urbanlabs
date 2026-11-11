import type { DatabaseSync } from 'node:sqlite';

// SQL contract harness: real SQLite transactions, NOT a claim of workerd/D1 compatibility.
export function sqliteContract(sqlite: DatabaseSync): D1Database {
  class Statement {
    values: (string | number | null)[] = [];
    constructor(readonly sql: string) {}
    bind(...values: (string | number | null)[]) {
      const next = new Statement(this.sql);
      next.values = values;
      return next;
    }
    async run() {
      return sqlite.prepare(this.sql).run(...this.values);
    }
    async all() {
      return { results: sqlite.prepare(this.sql).all(...this.values) };
    }
  }
  const db = {
    prepare: (sql: string) => new Statement(sql),
    async batch(statements: Statement[]) {
      sqlite.exec('BEGIN');
      try {
        const result = [];
        for (const statement of statements) result.push(await statement.run());
        sqlite.exec('COMMIT');
        return result;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  // Only methods used by the repository are implemented; runtime D1 has a separate suite.
  return db as unknown as D1Database;
}
