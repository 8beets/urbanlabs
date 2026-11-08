import { getSource, selectSources } from '../sources';
import type { SourceConfig } from './types';

/**
 * Sources chosen on the command line: none given means every approved source,
 * `--source id` one, `--sources a,b,c` several (a CI batch). IDs must be approved.
 */
export function selectedSources(args: string[]): SourceConfig[] {
  const single = args.indexOf('--source');
  const many = args.indexOf('--sources');
  if (single !== -1 && many !== -1)
    throw new Error('Use either --source or --sources, not both');
  if (single !== -1) {
    const id = args[single + 1];
    if (!id || id.startsWith('--'))
      throw new Error('--source requires an approved source ID');
    return selectSources(id);
  }
  if (many !== -1) {
    const value = args[many + 1];
    if (!value || value.startsWith('--'))
      throw new Error(
        '--sources requires a comma-separated list of source IDs',
      );
    const ids = value.split(',').map((id) => id.trim());
    if (ids.some((id) => !id) || new Set(ids).size !== ids.length)
      throw new Error('--sources must list each approved source ID once');
    return ids.map((id) => getSource(id));
  }
  return selectSources();
}
