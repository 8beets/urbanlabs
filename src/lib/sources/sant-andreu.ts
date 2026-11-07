import type { SourceConfig } from '../ingestion/types';

// Verified through the institution's official website and public registration footer.
export const santAndreu: SourceConfig = {
  id: 'miram-sant-andreu',
  name: 'Centre Cívic Sant Andreu · Miram',
  listingUrl:
    'https://santandreu.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=22&t=AC',
  institution: {
    id: 'cc-sant-andreu',
    name: 'Centre Cívic Sant Andreu',
    url: 'https://ajuntament.barcelona.cat/ccivics/santandreu',
    city: 'Barcelona',
    cityId: 'barcelona',
    country: 'ES',
    address: 'C/ Gran de Sant Andreu, 111, 08030 Barcelona',
    timezone: 'Europe/Madrid',
  },
};
