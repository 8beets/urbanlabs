import { canonicalCategory } from '../lib/courses/categories';

export const messages = {
  es: {
    pageNotFound: 'Página no encontrada',
    pageNotFoundIntro:
      'La página que buscas no existe o ha cambiado de dirección. Puedes seguir descubriendo oportunidades de aprendizaje desde estos enlaces.',
    homeNav: 'Inicio',
    searchTitle: 'Busca cursos y talleres',
    searchIntro: 'Encuentra cursos por centro, categoría y precio.',
    searchPageTitle: 'Buscar cursos y talleres · UrbanLabs',
    latestCourses: 'Últimos cursos añadidos',
    latestCoursesIntro:
      'Las últimas incorporaciones con ediciones vigentes, consultadas en fuentes oficiales.',
    viewAllCourses: 'Ver todos los cursos',
    latestEmpty:
      'Todavía no hay cursos publicados. Consulta los centros o vuelve más tarde.',
    mapTilesFailed: 'No se ha podido cargar el fondo del mapa.',
    directoryMapTitle: 'Mapa de centros',
    directoryMapIntro:
      'Centros con ubicación verificada. Selecciona un marcador para consultar el centro y sus cursos.',
    directoryMapFallback: 'Consulta todos los centros en el listado.',
    mapLoading: 'Cargando el mapa…',
    mapFailed: 'No se ha podido cargar el mapa.',
    directoryMapNoLocations:
      'Todavía no hay ubicaciones verificadas para mostrar en el mapa.',
    directoryMapLimited:
      'El mapa muestra una parte de los centros. Consulta el listado para ver los demás.',
    mapKeyboard:
      'Usa las flechas para mover el mapa y + o − para acercar o alejar. Con Tab puedes seleccionar marcadores y con Intro abrirlos.',
    zoomIn: 'Acercar',
    zoomOut: 'Alejar',
    primaryNavigation: 'Navegación principal',
    coursesNav: 'Cursos',
    centresNav: 'Centros',
    directoryTitle: 'Centros de aprendizaje en Barcelona',
    directoryIntro:
      'Descubre los centros, su ubicación y sus próximos cursos y talleres.',
    centreDetails: 'Información del centro',
    website: 'Web oficial',
    address: 'Dirección',
    phone: 'Teléfono',
    email: 'Correo electrónico',
    location: 'Ubicación',
    mapOf: 'Mapa de',
    largerMap: 'Ampliar mapa',
    mapUnavailable: 'La ubicación exacta todavía no está verificada.',
    searchAddress: 'Buscar dirección en OpenStreetMap',
    locationSource: 'Fuente de la ubicación',
    detailsSource: 'Fuente de los datos del centro',
    centreCourses: 'Próximos cursos y talleres',
    noCentreCourses:
      'No hay próximas ediciones publicadas para este centro. Consulta su web oficial.',
    notFound: 'No hemos encontrado este centro.',
    noCentres: 'Todavía no hay centros publicados.',
    closureNotice:
      'La guía municipal indica que este equipamiento está cerrado temporalmente. Confirma con el centro dónde se realizan sus actividades.',
    title: 'Aprende cerca de casa',
    description:
      'Cursos y talleres presenciales de organizaciones de Barcelona. Información de fuentes oficiales, con enlaces para consultar los detalles.',
    skip: 'Saltar al contenido',
    mission: 'Aprendizaje local, abierto a todo el mundo.',
    search: 'Buscar por título',
    searchExample: 'Ej. fotografía, yoga…',
    resultsIntro:
      'Encuentra una actividad y consulta los detalles en la web del centro.',
    price: 'Precio máximo (€)',
    submit: 'Buscar cursos',
    filters: 'Filtros de búsqueda',
    filtersLoading: 'Actualizando los filtros…',
    filtersFailed:
      'No se han podido actualizar los filtros. Puedes volver a cambiar la selección o buscar con los filtros actuales.',
    refine: 'Afinar la búsqueda',
    region: 'Comunidad autónoma',
    city: 'Ciudad',
    allRegions: 'Todas las comunidades',
    allCities: 'Todas las ciudades',
    emptyLocation: 'Todavía no hay cursos publicados en esta ubicación.',
    centre: 'Centro',
    category: 'Categoría',
    currentSelection: 'Selección actual',
    appliedFilters: 'Filtros aplicados',
    removeFilter: 'Quitar filtro',
    clear: 'Limpiar filtros',
    results: 'Cursos y talleres',
    categories: 'Explorar por categoría',
    allCategories: 'Todas las categorías',
    photoMusic: 'Música',
    photoPottery: 'Cerámica',
    photoElectronics: 'Electrónica',
    photoWoodworking: 'Bricolaje',
    photoNote: 'Imágenes ilustrativas de actividades de aprendizaje.',
    photoCredits: 'Fotografías de Pexels',
    explore: 'Encuentra tu próximo taller',
    centres: 'Explorar por centro',
    allCentres: 'Todos los centros',
    githubRepo: 'Código en GitHub',
    programming: 'Programación oficial',
    empty: 'Todavía no hay cursos que coincidan con tu búsqueda.',
    emptyHelp:
      'Estamos preparando el directorio con información de fuentes oficiales. Puedes consultar la programación del centro.',
    source: 'Consultar fuente oficial',
    unknownPrice: 'Precio por confirmar',
    unknownDates: 'Fechas por confirmar',
    verified: 'Consultado el',
    notice:
      'Las plazas y las condiciones pueden cambiar. Confirma siempre los detalles con la entidad organizadora.',
    previous: 'Anterior',
    next: 'Siguiente',
    pagination: 'Páginas de resultados',
    invalid:
      'Revisa los filtros: comprueba la búsqueda, el precio, la categoría, el centro y la ubicación.',
    unavailable:
      'El directorio no está disponible temporalmente. Vuelve a intentarlo más tarde.',
    language: 'Idioma',
    pageTitle: 'UrbanLabs · Cursos y talleres en Barcelona',
    footer:
      'Un proyecto gratuito y de código abierto para descubrir oportunidades de aprendizaje en la comunidad.',
  },
  ca: {
    pageNotFound: 'Pàgina no trobada',
    pageNotFoundIntro:
      'La pàgina que cerques no existeix o ha canviat d’adreça. Pots continuar descobrint oportunitats d’aprenentatge des d’aquests enllaços.',
    homeNav: 'Inici',
    searchTitle: 'Cerca cursos i tallers',
    searchIntro: 'Troba cursos per centre, categoria i preu.',
    searchPageTitle: 'Cerca cursos i tallers · UrbanLabs',
    latestCourses: 'Últims cursos afegits',
    latestCoursesIntro:
      'Les últimes incorporacions amb edicions vigents, consultades en fonts oficials.',
    viewAllCourses: 'Veure tots els cursos',
    latestEmpty:
      'Encara no hi ha cursos publicats. Consulta els centres o torna més tard.',
    mapTilesFailed: 'No s’ha pogut carregar el fons del mapa.',
    directoryMapTitle: 'Mapa de centres',
    directoryMapIntro:
      'Centres amb ubicació verificada. Selecciona un marcador per consultar el centre i els seus cursos.',
    directoryMapFallback: 'Consulta tots els centres al llistat.',
    mapLoading: 'S’està carregant el mapa…',
    mapFailed: 'No s’ha pogut carregar el mapa.',
    directoryMapNoLocations:
      'Encara no hi ha ubicacions verificades per mostrar al mapa.',
    directoryMapLimited:
      'El mapa mostra una part dels centres. Consulta el llistat per veure la resta.',
    mapKeyboard:
      'Fes servir les fletxes per moure el mapa i + o − per apropar o allunyar. Amb Tab pots seleccionar marcadors i amb Retorn obrir-los.',
    zoomIn: 'Apropa',
    zoomOut: 'Allunya',
    primaryNavigation: 'Navegació principal',
    coursesNav: 'Cursos',
    centresNav: 'Centres',
    directoryTitle: 'Centres d’aprenentatge a Barcelona',
    directoryIntro:
      'Descobreix els centres, la seva ubicació i els pròxims cursos i tallers.',
    centreDetails: 'Informació del centre',
    website: 'Web oficial',
    address: 'Adreça',
    phone: 'Telèfon',
    email: 'Correu electrònic',
    location: 'Ubicació',
    mapOf: 'Mapa de',
    largerMap: 'Amplia el mapa',
    mapUnavailable: 'La ubicació exacta encara no està verificada.',
    searchAddress: 'Cerca l’adreça a OpenStreetMap',
    locationSource: 'Font de la ubicació',
    detailsSource: 'Font de les dades del centre',
    centreCourses: 'Pròxims cursos i tallers',
    noCentreCourses:
      'No hi ha pròximes edicions publicades per a aquest centre. Consulta’n el web oficial.',
    notFound: 'No hem trobat aquest centre.',
    noCentres: 'Encara no hi ha centres publicats.',
    closureNotice:
      'La guia municipal indica que aquest equipament està tancat temporalment. Confirma amb el centre on es fan les seves activitats.',
    title: 'Aprèn a prop de casa',
    description:
      'Cursos i tallers presencials d’organitzacions de Barcelona. Informació de fonts oficials, amb enllaços per consultar-ne els detalls.',
    skip: 'Salta al contingut',
    mission: 'Aprenentatge local, obert a tothom.',
    search: 'Cerca per títol',
    searchExample: 'P. ex. fotografia, ioga…',
    resultsIntro:
      'Troba una activitat i consulta els detalls al web del centre.',
    price: 'Preu màxim (€)',
    submit: 'Cerca cursos',
    filters: 'Filtres de cerca',
    filtersLoading: 'Actualitzant els filtres…',
    filtersFailed:
      'No s’han pogut actualitzar els filtres. Pots tornar a canviar la selecció o cercar amb els filtres actuals.',
    refine: 'Afina la cerca',
    region: 'Comunitat autònoma',
    city: 'Ciutat',
    allRegions: 'Totes les comunitats',
    allCities: 'Totes les ciutats',
    emptyLocation: 'Encara no hi ha cursos publicats en aquesta ubicació.',
    centre: 'Centre',
    category: 'Categoria',
    currentSelection: 'Selecció actual',
    appliedFilters: 'Filtres aplicats',
    removeFilter: 'Treu el filtre',
    clear: 'Neteja els filtres',
    results: 'Cursos i tallers',
    categories: 'Explora per categoria',
    allCategories: 'Totes les categories',
    photoMusic: 'Música',
    photoPottery: 'Ceràmica',
    photoElectronics: 'Electrònica',
    photoWoodworking: 'Bricolatge',
    photoNote: 'Imatges il·lustratives d’activitats d’aprenentatge.',
    photoCredits: 'Fotografies de Pexels',
    explore: 'Troba el teu pròxim taller',
    centres: 'Explora per centre',
    allCentres: 'Tots els centres',
    githubRepo: 'Codi a GitHub',
    programming: 'Programació oficial',
    empty: 'Encara no hi ha cursos que coincideixin amb la teva cerca.',
    emptyHelp:
      'Estem preparant el directori amb informació de fonts oficials. Pots consultar la programació del centre.',
    source: 'Consulta la font oficial',
    unknownPrice: 'Preu per confirmar',
    unknownDates: 'Dates per confirmar',
    verified: 'Consultat el',
    notice:
      'Les places i les condicions poden canviar. Confirma sempre els detalls amb l’entitat organitzadora.',
    previous: 'Anterior',
    next: 'Següent',
    pagination: 'Pàgines de resultats',
    invalid:
      'Revisa els filtres: comprova la cerca, el preu, la categoria, el centre i la ubicació.',
    unavailable:
      'El directori no està disponible temporalment. Torna-ho a provar més tard.',
    language: 'Idioma',
    pageTitle: 'UrbanLabs · Cursos i tallers a Barcelona',
    footer:
      'Un projecte gratuït i de codi obert per descobrir oportunitats d’aprenentatge a la comunitat.',
  },
} as const;

export type Locale = keyof typeof messages;

// Interface labels for canonical categories; original provider labels stay in D1.
const categoryLabels: Record<string, Record<Locale, string>> = {
  'ACTIVITAT FÍSICA I BENESTAR': {
    es: 'Actividad física y bienestar',
    ca: 'Activitat física i benestar',
  },
  BALL: { es: 'Baile y danza', ca: 'Ball i dansa' },
  'ESPECIAL GENT GRAN': { es: 'Personas mayores', ca: 'Gent gran' },
  IDIOMES: { es: 'Idiomas', ca: 'Idiomes' },
  "ISA: FESTIVAL D'IL·LUSTRACIÓ": {
    es: 'ISA: Festival de ilustración',
    ca: 'ISA: Festival d’il·lustració',
  },
  'RECURSOS I CREATIVITAT': {
    es: 'Recursos y creatividad',
    ca: 'Recursos i creativitat',
  },
  ALTRES: { es: 'Otros', ca: 'Altres' },
  'ART I CREATIVITAT': { es: 'Arte y creatividad', ca: 'Art i creativitat' },
  CUINA: { es: 'Cocina', ca: 'Cuina' },
  'INFANTILS i JUVENILS': { es: 'Infancia y juventud', ca: 'Infants i joves' },
  MÚSICA: { es: 'Música', ca: 'Música' },
  'NOVES TECNOLOGIES': { es: 'Nuevas tecnologías', ca: 'Noves tecnologies' },
  FOTOGRAFIA: { es: 'Fotografía', ca: 'Fotografia' },
  CINEMA: { es: 'Cine', ca: 'Cinema' },
  'CIÈNCIES I HUMANITATS': {
    es: 'Ciencias y humanidades',
    ca: 'Ciències i humanitats',
  },
  EXPRESSIÓ: { es: 'Expresión y creatividad', ca: 'Expressió i creativitat' },
  HUMANITATS: { es: 'Humanidades', ca: 'Humanitats' },
  'Actualitat i història': {
    es: 'Actualidad e historia',
    ca: 'Actualitat i història',
  },
  Antropologia: { es: 'Antropología', ca: 'Antropologia' },
  'Art i pensament': { es: 'Arte y pensamiento', ca: 'Art i pensament' },
  'Natura i ciència': { es: 'Naturaleza y ciencia', ca: 'Natura i ciència' },
  'Creixement personal': {
    es: 'Crecimiento personal',
    ca: 'Creixement personal',
  },
  'HABILITATS I COMPETÈNCIES': {
    es: 'Habilidades y competencias',
    ca: 'Habilitats i competències',
  },
  'Art tèxtil': { es: 'Arte textil', ca: 'Art tèxtil' },
  Ciència: { es: 'Ciencia', ca: 'Ciència' },
  'Ràdio i pòdcast': { es: 'Radio y pódcast', ca: 'Ràdio i pòdcast' },
  FAMILIARS: { es: 'Talleres familiares', ca: 'Tallers familiars' },
  'INFORMÀTICA PER A GENT GRAN': {
    es: 'Informática para personas mayores',
    ca: 'Informàtica per a gent gran',
  },
  'FABRICACIÓ DIGITAL I ROBÒTICA': {
    es: 'Fabricación digital y robótica',
    ca: 'Fabricació digital i robòtica',
  },
  'MÉS ECO': { es: 'Más eco', ca: 'Més eco' },
  PARAULA: { es: 'Palabra', ca: 'Paraula' },
  "ReGENERA'T": { es: 'ReGENERA’T', ca: 'ReGENERA’T' },
};

export function categoryLabel(category: string, locale: Locale): string {
  const canonical = canonicalCategory(category);
  const label = categoryLabels[canonical]?.[locale];
  if (label) return label;
  // Unknown all-caps source categories get readable casing, without invented translation.
  if (canonical !== canonical.toLocaleUpperCase(locale)) return canonical;
  const lower = canonical.toLocaleLowerCase(locale);
  return lower.charAt(0).toLocaleUpperCase(locale) + lower.slice(1);
}

export function formatLocalDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}
