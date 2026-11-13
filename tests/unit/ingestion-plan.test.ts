import { describe, expect, it } from 'vitest';
import { planIngestion } from '../../src/lib/ingestion/plan';
import { Command } from 'commander';
import {
  selectedSources as selectFromOptions,
  withSourceOptions,
} from '../../src/commands/options';
import { sources } from '../../src/lib/sources';

// Parses like the commands do, so invalid flags are covered too.
const selectedSources = (args: string[]) => {
  const command = withSourceOptions(
    new Command()
      .option('--live')
      .exitOverride()
      .configureOutput({ writeErr: () => {} }),
  ).parse(args, { from: 'user' });
  return selectFromOptions(command.opts());
};

const now = new Date('2026-11-09T04:17:00Z');
const options = { now, minAgeHours: 20, maxSources: 100, batchSize: 3 };
const at = (hoursAgo: number) =>
  new Date(now.getTime() - hoursAgo * 3_600_000).toISOString();

describe('ingestion plan', () => {
  it('puts never-imported sources first, then the stalest, in batches', () => {
    const plan = planIngestion(
      [
        { id: 'recent', lastSuccessAt: at(30) },
        { id: 'oldest', lastSuccessAt: at(200) },
        { id: 'new-a', lastSuccessAt: null },
        { id: 'new-b', lastSuccessAt: null },
        { id: 'middle', lastSuccessAt: at(48) },
      ],
      options,
    );
    expect(plan.batches).toEqual([
      ['new-a', 'new-b', 'oldest'],
      ['middle', 'recent'],
    ]);
    expect(plan.planned).toBe(5);
    expect(plan.deferred).toBe(0);
  });

  it('leaves sources refreshed within the minimum age for a later run', () => {
    const plan = planIngestion(
      [
        { id: 'fresh', lastSuccessAt: at(2) },
        { id: 'edge', lastSuccessAt: at(20) },
        { id: 'due', lastSuccessAt: at(21) },
      ],
      options,
    );
    expect(plan.batches).toEqual([['due', 'edge']]);
    expect(plan.deferred).toBe(1);
  });

  it('caps the run at the stalest sources so the rest rotate in', () => {
    const statuses = Array.from({ length: 10 }, (_, index) => ({
      id: `s${index}`,
      lastSuccessAt: at(100 + index),
    }));
    const plan = planIngestion(statuses, { ...options, maxSources: 4 });
    // The longest-unrefreshed sources are s9, s8, s7, s6.
    expect(plan.batches).toEqual([['s9', 's8', 's7'], ['s6']]);
    expect(plan.deferred).toBe(6);
  });

  it('keeps registry order for ties and returns no batches when nothing is due', () => {
    expect(
      planIngestion(
        [
          { id: 'b', lastSuccessAt: null },
          { id: 'a', lastSuccessAt: null },
        ],
        options,
      ).batches,
    ).toEqual([['b', 'a']]);
    expect(
      planIngestion([{ id: 'x', lastSuccessAt: at(1) }], options).batches,
    ).toEqual([]);
  });

  it.each([
    [{ maxSources: 0 }],
    [{ batchSize: 0 }],
    [{ batchSize: 1.5 }],
    [{ minAgeHours: -1 }],
    [{ minAgeHours: Number.NaN }],
  ])('rejects unusable options %j', (change) => {
    expect(() =>
      planIngestion([{ id: 'x', lastSuccessAt: null }], {
        ...options,
        ...change,
      }),
    ).toThrow();
  });

  it('fails loudly on a malformed timestamp instead of guessing', () => {
    expect(() =>
      planIngestion([{ id: 'x', lastSuccessAt: 'yesterday' }], options),
    ).toThrow('Invalid last success time for x');
  });
});

describe('command-line source selection', () => {
  it('defaults to every approved source', () => {
    expect(selectedSources(['--live'])).toHaveLength(sources.length);
  });

  it('selects one source or an explicit batch in the given order', () => {
    expect(selectedSources(['--source', 'miram-fort-pienc'])).toHaveLength(1);
    expect(
      selectedSources([
        '--live',
        '--sources',
        'miram-urgell,miram-can-baste',
      ]).map((s) => s.id),
    ).toEqual(['miram-urgell', 'miram-can-baste']);
  });

  it('selects every approved source in a city', () => {
    const girona = selectedSources(['--city', 'girona']);
    expect(girona.length).toBeGreaterThan(0);
    expect(girona.length).toBe(
      sources.filter((s) => s.institution.cityId === 'girona').length,
    );
  });

  it.each([
    [['--city', 'atlantis']],
    [['--city', 'girona', '--source', 'miram-urgell']],
    [['--source']],
    [['--source', '--live']],
    [['--sources']],
    [['--sources', 'miram-urgell,']],
    [['--sources', 'miram-urgell,miram-urgell']],
    [['--sources', 'miram-urgell,not-approved']],
    [['--source', 'miram-urgell', '--sources', 'miram-can-baste']],
  ])('rejects %j', (args) => {
    expect(() => selectedSources(args)).toThrow();
  });
});
