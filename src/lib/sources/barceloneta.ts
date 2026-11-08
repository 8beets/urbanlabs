import type { SourceConfig } from '../ingestion/types';

// `t=AC` is the course catalogue; the host's `CE` type (shows and talks) is never followed.
export const barceloneta: SourceConfig = {
  id: 'miram-barceloneta',
  name: 'Centre Cívic Barceloneta · Miram',
  listingUrl:
    'https://civicbarceloneta.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=51&t=AC',
  institution: {
    id: 'cc-barceloneta',
    name: 'Centre Cívic Barceloneta',
    url: 'https://ajuntament.barcelona.cat/ccivics/barceloneta',
    city: 'Barcelona',
    cityId: 'barcelona',
    country: 'ES',
    address: 'C/ Conreria, 1-9, 08003 Barcelona',
    timezone: 'Europe/Madrid',
  },
};
