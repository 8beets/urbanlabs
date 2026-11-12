import { createAulaAbiertaAdapter } from './aula-abierta';
import { createMiramAdapter } from './miram';
import { createTarragonaAdapter } from './tarragona-centres-civics';
import { createZaragozaAdapter } from './zaragoza-centros-civicos';
import { createGironaAdapter } from './girona-centres-civics';
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
    case 'zaragoza-centros-civicos':
      return createZaragozaAdapter(options);
    case 'girona-centres-civics':
      return createGironaAdapter(options);
  }
}
