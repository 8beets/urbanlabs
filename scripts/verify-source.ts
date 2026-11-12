import { parseArgs } from 'node:util';
import { adapterFor } from '../src/lib/ingestion/adapters';
import { selectSources } from '../src/lib/sources';

const [sourceId] = parseArgs({ allowPositionals: true }).positionals;
for (const source of selectSources(sourceId)) {
  const records = await adapterFor(source).fetchRecords(source);
  console.info(
    JSON.stringify(
      {
        source: source.id,
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
