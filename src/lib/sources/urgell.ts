import type { SourceConfig } from '../ingestion/types';

export const urgell: SourceConfig = {
  id: 'miram-urgell',
  name: 'Centre Cívic Urgell · Miram',
  listingUrl:
    'https://ccurgell.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=10&t=AC',
  institution: {
    id: 'cc-urgell',
    name: 'Centre Cívic Urgell',
    url: 'https://www.ccurgell.cat/',
    city: 'Barcelona',
    cityId: 'barcelona',
    country: 'ES',
    address: 'C/ del Comte d’Urgell, 145, 08036 Barcelona',
    timezone: 'Europe/Madrid',
  },
};
