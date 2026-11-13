import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import {
  renderStatement,
  describeCommandFailure,
  parseCommandResults,
} from '../../src/lib/db/wrangler-ingestion';

describe('Wrangler SQL transport', () => {
  it('accepts validated JSON after file-import progress, preserving JSON inside data', () => {
    const results = [
      { success: true, results: [{ title: 'a [title] and ?' }] },
    ];
    expect(parseCommandResults(JSON.stringify(results, null, 2))).toEqual(
      results,
    );
    expect(
      parseCommandResults(
        '├ Checking upload\n[progress]\n' + JSON.stringify(results, null, 2),
      ),
    ).toEqual(results);
  });
  it('rejects failed, missing, and malformed command results', () => {
    for (const output of [
      '',
      '[]',
      '[{"success":false,"results":[]}]',
      '├ Done\n[broken]',
    ]) {
      expect(() => parseCommandResults(output)).toThrow('successful D1');
    }
  });
  it('preserves apostrophes, question marks, Unicode, and injection-like text as literal data', () => {
    const db = new DatabaseSync(':memory:');
    try {
      db.exec('CREATE TABLE records (title TEXT, price INTEGER, unknown TEXT)');
      const title = "L'art?'); DROP TABLE records; -- fotografía";
      db.exec(
        renderStatement('INSERT INTO records VALUES (?, ?, ?)', [
          title,
          1234,
          null,
        ]),
      );
      expect(db.prepare('SELECT * FROM records').get()).toMatchObject({
        title,
        price: 1234,
        unknown: null,
      });
    } finally {
      db.close();
    }
  });
  it('rejects mismatched placeholders and non-finite numeric values', () => {
    expect(() => renderStatement('SELECT ?', [])).toThrow('count');
    expect(() => renderStatement('SELECT ?', [NaN])).toThrow('numeric');
    expect(() => renderStatement('SELECT ?', [Infinity])).toThrow('numeric');
  });
});

describe('describeCommandFailure', () => {
  it('reports the D1 error from stdout, a timeout, or the bare message', () => {
    const failed = Object.assign(
      new Error('Command failed: wrangler\nwarning'),
      {
        stdout: '\x1b[31m{"error":{"text":"SQLITE_TOOBIG"}}\x1b[0m\n',
      },
    );
    expect(describeCommandFailure(failed)).toBe(
      'Wrangler D1 command failed: {"error":{"text":"SQLITE_TOOBIG"}}',
    );
    expect(
      describeCommandFailure(
        Object.assign(new Error('x'), { killed: true, signal: 'SIGTERM' }),
      ),
    ).toBe('Wrangler D1 command timed out (SIGTERM)');
    expect(
      describeCommandFailure(new Error('Command failed: wrangler\nwarn')),
    ).toBe('Wrangler D1 command failed: Command failed: wrangler');
  });
});
