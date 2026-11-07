import type { SourceConfig } from '../ingestion/types';

export const vilLaUrania: SourceConfig = {
  id: 'miram-vil-la-urania',
  name: 'Centre Cívic Vil·la Urània · Miram',
  listingUrl:
    'https://vil-laurania.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=49&t=AC',
  institution: {
    id: 'cc-vil-la-urania',
    name: 'Centre Cívic Vil·la Urània',
    url: 'https://ajuntament.barcelona.cat/ccivics/vil.laurania/',
    city: 'Barcelona',
    cityId: 'barcelona',
    country: 'ES',
    address: 'C/ de Saragossa, 29, 08006 Barcelona',
    timezone: 'Europe/Madrid',
  },
};
