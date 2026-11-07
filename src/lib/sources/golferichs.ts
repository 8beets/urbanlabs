import type { SourceConfig } from '../ingestion/types';

export const golferichs: SourceConfig = {
  id: 'miram-golferichs',
  name: 'Centre Cívic Casa Golferichs · Miram',
  listingUrl:
    'https://golferichs.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=29&t=AC',
  institution: {
    id: 'cc-golferichs',
    name: 'Centre Cívic Casa Golferichs',
    url: 'https://www.golferichs.org/',
    city: 'Barcelona',
    cityId: 'barcelona',
    country: 'ES',
    address: 'Gran Via de les Corts Catalanes, 491, 08015 Barcelona',
    timezone: 'Europe/Madrid',
  },
};
