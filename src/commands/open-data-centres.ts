import { readFile } from 'node:fs/promises';
import { Command } from 'commander';
import { formatISO } from 'date-fns';
import { createSourceFetcher } from '../lib/ingestion/http';
import { draftOpenDataCentre, openDataCentres } from '../lib/centres/open-data';
import { OPEN_DATA_ORIGIN, openDataRawPath } from '../lib/centres/schema';

export const openDataCentresCommand = new Command('open-data-centres')
  .description(
    "Read a city's centres.csv from 8beets/urban-open-courses-data and print draft registry records for data/centres/<country>/<city>.json. A person reviews them before committing.",
  )
  .argument('<folder>', 'city folder, e.g. es/catalunya/barcelona')
  .option('--file <path>', 'read a local centres.csv instead of fetching it')
  .action(async (folder: string, { file }: { file?: string }) => {
    if (!/^[a-z]{2}\/[a-z0-9-]+\/[a-z0-9-]+$/.test(folder))
      throw new Error('Folder must look like es/catalunya/barcelona');
    const csv = file
      ? await readFile(file, 'utf8')
      : await createSourceFetcher(OPEN_DATA_ORIGIN)(
          `${OPEN_DATA_ORIGIN}${openDataRawPath(folder, 'centres.csv')}`,
          true,
        );
    if (csv === null) throw new Error(`No centres.csv in ${folder}`);
    const today = formatISO(new Date(), { representation: 'date' });
    const drafts = openDataCentres(csv).map((centre) =>
      draftOpenDataCentre(centre, folder, today),
    );
    console.error(
      `${drafts.length} centre(s). Check names, addresses and map points, then add them to data/centres/${folder.split('/')[0]}/${folder.split('/')[2]}.json.`,
    );
    console.log(JSON.stringify(drafts, null, 2));
  });
