import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import type { IngestionDatabase, IngestionStatement } from './ingestion-port';

const exec = promisify(execFile);
const commandResults = z
  .array(z.object({ success: z.literal(true), results: z.array(z.unknown()) }))
  .min(1);
// File imports print progress before the final JSON array, even with --json.
export function parseCommandResults(stdout: string) {
  for (const match of stdout.matchAll(/^\s*\[/gm)) {
    try {
      return commandResults.parse(JSON.parse(stdout.slice(match.index)));
    } catch {
      // A progress line can start with '['; only accept a validated final array.
    }
  }
  throw new Error('Wrangler did not return successful D1 JSON results');
}
type SqlValue = string | number | null;

// Wrangler prints the D1 error on stdout (--json) and only warnings on stderr, and a
// timeout kills it silently; say which, so a failed ingestion can be diagnosed.
export function describeCommandFailure(error: unknown): string {
  const { killed, signal, stdout } = (error ?? {}) as {
    killed?: boolean;
    signal?: string | null;
    stdout?: unknown;
  };
  if (killed) return `Wrangler D1 command timed out (${signal ?? 'killed'})`;
  const output = String(stdout ?? '')
    // eslint-disable-next-line no-control-regex -- strips ANSI colours
    .replace(/\x1b\[[0-9;]*m/g, '')
    .trim();
  const reason = error instanceof Error ? error.message.split('\n')[0] : '';
  return output
    ? `Wrangler D1 command failed: ${output.slice(-2000)}`
    : `Wrangler D1 command failed: ${reason}`;
}

export function renderStatement(sql: string, values: SqlValue[]): string {
  const parts = sql.split('?');
  if (parts.length !== values.length + 1)
    throw new Error('SQL parameter count mismatch');
  return parts
    .map((part, index) => {
      if (index === values.length) return part;
      const value = values[index]!;
      if (value === null) return part + 'NULL';
      if (typeof value === 'number') {
        if (!Number.isFinite(value))
          throw new Error('Invalid SQL numeric parameter');
        return part + String(value);
      }
      return part + "'" + value.replaceAll("'", "''") + "'";
    })
    .join('');
}

class Statement implements IngestionStatement {
  constructor(
    readonly db: WranglerIngestionDatabase,
    readonly sql: string,
    readonly values: SqlValue[] = [],
  ) {}
  bind(...values: SqlValue[]) {
    return new Statement(this.db, this.sql, values);
  }
  run() {
    return this.db.query(renderStatement(this.sql, this.values));
  }
  async all<T>(): Promise<{ results: T[] }> {
    const response = await this.db.query(
      renderStatement(this.sql, this.values),
    );
    return { results: response.flatMap((result) => result.results) as T[] };
  }
}

/** Remote-only CLI bridge; authentication stays inside Wrangler. Never bundled in the Worker. */
export class WranglerIngestionDatabase implements IngestionDatabase {
  prepare(sql: string) {
    return new Statement(this, sql);
  }

  private async execute(args: string[]) {
    const { stdout } = await exec(
      process.execPath,
      [
        resolve('node_modules/wrangler/bin/wrangler.js'),
        'd1',
        'execute',
        'DB',
        '--config',
        'wrangler.jsonc',
        '--env',
        'production',
        '--remote',
        '--json',
        ...args,
      ],
      { timeout: 90000, maxBuffer: 4_000_000 },
    ).catch((error: unknown) => {
      throw new Error(describeCommandFailure(error), { cause: error });
    });
    return parseCommandResults(stdout);
  }

  async query(sql: string): Promise<{ results: unknown[] }[]> {
    const response = await this.execute(['--command', sql]);
    return response;
  }

  async batch(statements: IngestionStatement[]) {
    const sql = statements
      .map((statement) => {
        if (!(statement instanceof Statement) || statement.db !== this)
          throw new Error('Statement belongs to a different database');
        return (
          renderStatement(statement.sql, statement.values)
            .trim()
            .replace(/;$/, '') + ';'
        );
      })
      .join('\n');
    const directory = await mkdtemp(join(tmpdir(), 'learnaprop-d1-'));
    try {
      const file = join(directory, 'batch.sql');
      await writeFile(file, sql, { mode: 0o600 });
      // D1's file-import operation rolls a failed snapshot back to its original state.
      return await this.execute(['--file', file]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
