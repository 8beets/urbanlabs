import { getSource, selectSources, sources as approved } from '../sources';
import type { SourceConfig } from './types';

/** `util.parseArgs` options shared by the ingestion scripts. */
export const sourceOptions = {
  source: { type: 'string' },
  sources: { type: 'string' },
  city: { type: 'string' },
} as const;

/**
 * Sources chosen on the command line: none given means every approved source,
 * `--source id` one, `--sources a,b,c` several (a CI batch), `--city id` every source
 * in that city. IDs must be approved.
 */
export function selectedSources({
  source,
  sources,
  city,
}: {
  source?: string;
  sources?: string;
  city?: string;
}): SourceConfig[] {
  if ([source, sources, city].filter((value) => value !== undefined).length > 1)
    throw new Error('Use only one of --source, --sources or --city');
  if (city !== undefined) {
    const matches = approved.filter(
      (candidate) => candidate.institution.cityId === city,
    );
    if (!matches.length)
      throw new Error(`No approved sources in city: ${city}`);
    return matches;
  }
  if (source !== undefined) {
    if (!source) throw new Error('--source requires an approved source ID');
    return selectSources(source);
  }
  if (sources !== undefined) {
    const ids = sources.split(',').map((id) => id.trim());
    if (ids.some((id) => !id) || new Set(ids).size !== ids.length)
      throw new Error('--sources must list each approved source ID once');
    return ids.map((id) => getSource(id));
  }
  return selectSources();
}
