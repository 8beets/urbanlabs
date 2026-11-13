import { Command } from 'commander';
import { adapterFor } from '../lib/ingestion/adapters';
import {
  selectedSources,
  withSourceOptions,
  type SourceSelection,
} from './options';

export const sourceVerifyCommand = withSourceOptions(
  new Command('source-verify')
    .description(
      'Fetch approved sources live and print a sample (nothing is stored)',
    )
    .argument('[source]', 'approved source ID (same as --source)'),
).action(async (source: string | undefined, options: SourceSelection) => {
  for (const config of selectedSources({
    ...options,
    source: source ?? options.source,
  })) {
    const records = await adapterFor(config).fetchRecords(config);
    console.info(
      JSON.stringify(
        {
          source: config.id,
          verifiedAt: new Date().toISOString(),
          count: records.length,
          sample: records
            .slice(0, 3)
            .map(({ externalId, title, startDate, priceCents }) => ({
              externalId,
              title,
              startDate,
              priceCents,
            })),
        },
        null,
        2,
      ),
    );
  }
});
