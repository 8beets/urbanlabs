import type { SourceConfig } from '../ingestion/types';

// `t=AC` is the "Tallers Culturals" course catalogue. The host's other types
// (`BI` itineraries, `CE` shows and talks) are outside the course directory and
// are never reached because the adapter only follows links with the same `t`.
export const fortPienc: SourceConfig = {
  id: 'miram-fort-pienc',
  name: 'Centre Cívic Ateneu Fort Pienc · Miram',
  listingUrl:
    'https://fortpienc.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=5&t=AC',
  institution: {
    id: 'cc-fort-pienc',
    name: 'Centre Cívic Ateneu Fort Pienc',
    url: 'https://www.fortpienc.org/',
    city: 'Barcelona',
    cityId: 'barcelona',
    country: 'ES',
    address: 'Plaça Fort Pienc, 4-5, 08013 Barcelona',
    timezone: 'Europe/Madrid',
  },
};
