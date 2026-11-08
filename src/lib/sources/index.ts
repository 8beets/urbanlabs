import { santAndreu } from './sant-andreu';
import { canBaste } from './can-baste';
import { patiLlimona } from './pati-llimona';
import { golferichs } from './golferichs';
import { casaElizalde } from './casa-elizalde';
import { albareda } from './albareda';
import { elSortidor } from './el-sortidor';
import { vilLaUrania } from './vil-la-urania';
import { urgell } from './urgell';
import { fabCasaDelRellotge } from './fab-casa-del-rellotge';
import { fabCasaDelMig } from './fab-casa-del-mig';
import { fortPienc } from './fort-pienc';
import { canCastello } from './can-castello';
import { baroDeViver } from './baro-de-viver';
import { barceloneta } from './barceloneta';

export const sources = [
  santAndreu,
  canBaste,
  patiLlimona,
  golferichs,
  casaElizalde,
  albareda,
  elSortidor,
  vilLaUrania,
  urgell,
  fabCasaDelRellotge,
  fabCasaDelMig,
  fortPienc,
  barceloneta,
  baroDeViver,
  canCastello,
];

export function selectSources(sourceId?: string) {
  if (!sourceId) return sources;
  const source = sources.find((source) => source.id === sourceId);
  if (!source) throw new Error(`Unknown approved source: ${sourceId}`);
  return [source];
}
