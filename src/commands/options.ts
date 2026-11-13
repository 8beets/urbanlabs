import { InvalidArgumentError, Option, type Command } from 'commander';
import { getSource, sources as approved } from '../lib/sources';
import type { SourceConfig } from '../lib/ingestion/types';

/** Commander parser for non-negative integer option values. */
export function integer(value: string): number {
  const parsed = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(parsed))
    throw new InvalidArgumentError('Expected a non-negative integer.');
  return parsed;
}

export interface SourceSelection {
  source?: string;
  sources?: string;
  city?: string;
}

/** `--source id`, `--sources a,b,c` (a CI batch) or `--city id`; at most one. */
export function withSourceOptions(command: Command): Command {
  return command
    .addOption(
      new Option('--source <id>', 'one approved source').conflicts([
        'sources',
        'city',
      ]),
    )
    .addOption(
      new Option(
        '--sources <ids>',
        'comma-separated approved sources',
      ).conflicts('city'),
    )
    .addOption(
      new Option('--city <id>', 'every approved source in a city, e.g. girona'),
    );
}

/** Sources chosen on the command line; none given means every approved source. */
export function selectedSources({
  source,
  sources,
  city,
}: SourceSelection): SourceConfig[] {
  if ([source, sources, city].filter((value) => value !== undefined).length > 1)
    throw new Error('Use only one of --source, --sources or --city');
  if (source !== undefined) return [getSource(source)];
  if (sources !== undefined) {
    const ids = sources.split(',').map((id) => id.trim());
    if (ids.some((id) => !id) || new Set(ids).size !== ids.length)
      throw new Error('--sources must list each approved source ID once');
    return ids.map((id) => getSource(id));
  }
  if (city !== undefined) {
    const matches = approved.filter(
      (candidate) => candidate.institution.cityId === city,
    );
    if (!matches.length)
      throw new Error(`No approved sources in city: ${city}`);
    return matches;
  }
  return approved;
}

export const isExplicit = ({ source, sources, city }: SourceSelection) =>
  source !== undefined || sources !== undefined || city !== undefined;
