import { createAulaAbiertaAdapter } from './aula-abierta';
import { createMiramAdapter } from './miram';
import { createTarragonaAdapter } from './tarragona-centres-civics';
import type { FetchOptions } from '../http';
import type { SourceAdapter, SourceConfig } from '../types';

/** The adapter for a source's platform; add one case per supported platform. */
export function adapterFor(
  source: SourceConfig,
  options: FetchOptions = {},
): SourceAdapter {
  switch (source.platform) {
    case 'miram':
      return createMiramAdapter(options);
    case 'alicante-aula-abierta':
      return createAulaAbiertaAdapter(options);
    case 'tarragona-centres-civics':
      return createTarragonaAdapter(options);
  }
}
