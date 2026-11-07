import type { SourceConfig } from '../ingestion/types';
export const fabCasaDelMig: SourceConfig = {
  id: 'miram-fab-casa-del-mig',
  name: 'FAB Casa del Mig · Miram',
  listingUrl:
    'https://fabcasadelmig.miram.cloud/MiramModular/buscador/buscador.jsp?g=1&c=9903&t=CM',
  // Meetups and talks are outside the course directory.
  excludedCategoryCodes: ['02'],
  institution: {
    id: 'fab-casa-del-mig',
    name: 'FAB Casa del Mig',
    url: 'https://www.fabcasadelmig.cat/',
    city: 'Barcelona',
    cityId: 'barcelona',
    country: 'ES',
    address: 'C/ de Muntadas, 1–5, 08014 Barcelona',
    timezone: 'Europe/Madrid',
  },
};
