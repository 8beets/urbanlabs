import type { SourceConfig } from '../ingestion/types';
export const fabCasaDelRellotge: SourceConfig = {
  id: 'miram-fab-casa-del-rellotge',
  name: 'FAB Casa del Rellotge · Miram',
  listingUrl:
    'https://fabcasadelmig.miram.cloud/MiramModular/buscador/buscador.jsp?g=1&c=9903&t=CR',
  institution: {
    id: 'fab-casa-del-rellotge',
    name: 'FAB Casa del Rellotge',
    url: 'https://fabcasadelrellotge.cat/',
    city: 'Barcelona',
    cityId: 'barcelona',
    country: 'ES',
    address: 'Pg. de la Zona Franca, 116, Barcelona',
    timezone: 'Europe/Madrid',
  },
};
