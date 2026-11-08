import type { SourceConfig } from '../ingestion/types';

// `t=AC` is the course catalogue; the host's `CE` type (shows and talks) is never followed.
export const baroDeViver: SourceConfig = {
  id: 'miram-baro-de-viver',
  name: 'Centre Cívic Baró de Viver · Miram',
  // 2300–2302 are free childcare services for another workshop's participants, not courses.
  excludedExternalIds: ['2300', '2301', '2302'],
  listingUrl:
    'https://barodeviver.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=14&t=AC',
  institution: {
    id: 'cc-baro-de-viver',
    name: 'Centre Cívic Baró de Viver',
    url: 'https://ajuntament.barcelona.cat/ccivics/barodeviver',
    city: 'Barcelona',
    cityId: 'barcelona',
    country: 'ES',
    address: 'C/ Quito, 8-10, 08030 Barcelona',
    timezone: 'Europe/Madrid',
  },
};
