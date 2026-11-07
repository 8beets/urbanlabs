import type { SourceConfig } from '../ingestion/types';

export const elSortidor: SourceConfig = {
  // This category currently contains a musical show rather than a workshop.
  excludedCategoryCodes: ['TC'],
  id: 'miram-el-sortidor',
  name: 'Centre Cívic El Sortidor · Miram',
  listingUrl:
    'https://elsortidor.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=27&t=AC',
  institution: {
    id: 'cc-el-sortidor',
    name: 'Centre Cívic El Sortidor',
    url: 'https://ajuntament.barcelona.cat/ccivics/elsortidor/',
    city: 'Barcelona',
    cityId: 'barcelona',
    country: 'ES',
    address: 'Plaça del Sortidor, 12, 08004 Barcelona',
    timezone: 'Europe/Madrid',
  },
};
