import { centres } from '../centres/registry';
import { toSourceConfig } from '../centres/schema';
import type { SourceConfig } from '../ingestion/types';

// Approved sources are generated from the centre registry (data/centres/*.json).
// Paused centres (e.g. awaiting permission to reuse their source) are excluded.
export const sources: SourceConfig[] = centres
  .filter((centre) => !centre.pausedReason)
  .map(toSourceConfig);

export function selectSources(sourceId?: string) {
  if (!sourceId) return sources;
  return [getSource(sourceId)];
}

export function getSource(sourceId: string): SourceConfig {
  const source = sources.find((source) => source.id === sourceId);
  if (!source) throw new Error(`Unknown approved source: ${sourceId}`);
  return source;
}
