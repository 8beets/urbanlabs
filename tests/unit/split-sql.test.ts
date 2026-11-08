import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { expect, it } from 'vitest';
import { splitStatements } from '../helpers/split-sql';

it('splits every migration into statements D1 can prepare one by one', () => {
  const directory = new URL('../../migrations/', import.meta.url);
  const migration = readdirSync(directory)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => readFileSync(new URL(name, directory), 'utf8'))
    .join('\n');
  const statements = splitStatements(migration);
  expect(statements.filter((sql) => /^CREATE TRIGGER/i.test(sql))).toHaveLength(
    3,
  );
  const sqlite = new DatabaseSync(':memory:');
  for (const sql of statements) sqlite.exec(sql);
  expect(
    sqlite
      .prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='trigger'")
      .get()?.n,
  ).toBe(3);
  sqlite.close();
});
