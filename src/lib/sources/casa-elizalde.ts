import type { SourceConfig } from '../ingestion/types';

export const casaElizalde: SourceConfig = {
  id: 'miram-casa-elizalde',
  name: 'Centre Cultural La Casa Elizalde · Miram',
  listingUrl:
    'https://casaelizalde.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=56&t=AC',
  // Online-only workshops are outside the in-person directory.
  excludedCategoryCodes: ['CO'],
  institution: {
    id: 'cc-casa-elizalde',
    name: 'Centre Cultural La Casa Elizalde',
    url: 'https://www.casaelizalde.com/',
    city: 'Barcelona',
    cityId: 'barcelona',
    country: 'ES',
    address: 'C/ de València, 302, 08009 Barcelona',
    timezone: 'Europe/Madrid',
  },
};
