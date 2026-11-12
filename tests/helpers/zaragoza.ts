import { readFileSync } from 'node:fs';
import { parseZaragozaList } from '../../src/lib/ingestion/adapters/zaragoza-centros-civicos';

/** Course records of the saved Centro Cívico Universidad listing (`idLugar` 2119). */
export const universidadRecords = () =>
  parseZaragozaList(
    JSON.parse(
      readFileSync(
        new URL('../fixtures/zaragoza-universidad.json', import.meta.url),
        'utf8',
      ),
    ),
    2119,
  );
