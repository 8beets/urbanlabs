import type { SourceConfig } from '../ingestion/types';

export const canBaste: SourceConfig = {
  id: 'miram-can-baste',
  name: 'Centre Cívic Can Basté · Miram',
  listingUrl:
    'https://canbaste.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=30&t=AC',
  // The provider's ALTRES category includes concerts, outside the course directory.
  excludedCategoryCodes: ['14'],
  institution: {
    id: 'cc-can-baste',
    name: 'Centre Cívic Can Basté',
    url: 'https://www.canbaste.com/',
    city: 'Barcelona',
    cityId: 'barcelona',
    country: 'ES',
    address: 'Pg. de Fabra i Puig, 274, 08031 Barcelona',
    timezone: 'Europe/Madrid',
  },
};
