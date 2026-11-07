import type { SourceConfig } from '../ingestion/types';

export const patiLlimona: SourceConfig = {
  id: 'miram-pati-llimona',
  name: 'Centre Cívic Pati Llimona · Miram',
  listingUrl:
    'https://patillimona.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=1&t=AC',
  // Explicitly cancelled workshops and a screening, verified in the source listing.
  excludedExternalIds: ['5036', '5038', '5088'],
  institution: {
    id: 'cc-pati-llimona',
    name: 'Centre Cívic Pati Llimona',
    url: 'https://patillimona.net/',
    city: 'Barcelona',
    cityId: 'barcelona',
    country: 'ES',
    address: 'C/ del Regomir, 3, 08002 Barcelona',
    timezone: 'Europe/Madrid',
  },
};
