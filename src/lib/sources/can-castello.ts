import type { SourceConfig } from '../ingestion/types';

// `t=AC` is the course catalogue; the host's `CE` type (shows and talks) is never followed.
export const canCastello: SourceConfig = {
  id: 'miram-can-castello',
  name: 'Centre Cívic Can Castelló · Miram',
  listingUrl:
    'https://cancastello.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=32&t=AC',
  institution: {
    id: 'cc-can-castello',
    name: 'Centre Cívic Can Castelló',
    url: 'https://ajuntament.barcelona.cat/ccivics/cancastello',
    city: 'Barcelona',
    cityId: 'barcelona',
    country: 'ES',
    address: 'C/ Castelló, 1-7, 08021 Barcelona',
    timezone: 'Europe/Madrid',
  },
};
