import type { SourceConfig } from '../ingestion/types';

export const albareda: SourceConfig = {
  id: 'miram-albareda',
  name: 'Centre Cultural Albareda · Miram',
  listingUrl:
    'https://albareda.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=13&t=AC',
  institution: {
    id: 'cc-albareda',
    name: 'Centre Cultural Albareda',
    url: 'https://ajuntament.barcelona.cat/ccivics/albareda/',
    city: 'Barcelona',
    cityId: 'barcelona',
    country: 'ES',
    address: 'C/ d’Albareda, 22–24, 08004 Barcelona',
    timezone: 'Europe/Madrid',
  },
};
