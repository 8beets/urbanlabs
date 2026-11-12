import { foldText } from '../catalog/title-match';

// Centres label their courses with hundreds of inconsistent categories. Every course
// is shown under one of these fixed topics instead, chosen deterministically from
// reviewed tables (issue #95). Source categories stay stored unchanged, so a change
// here only needs a rebuild.

/** Topic ids double as URL values (`?category=`) and category page slugs. */
export const TOPICS = [
  'arts-i-manualitats',
  'fotografia-i-audiovisual',
  'musica',
  'dansa',
  'teatre',
  'activitat-fisica',
  'benestar',
  'cuina',
  'idiomes',
  'humanitats-i-ciencia',
  'tecnologia',
  'natura',
  'altres',
] as const;
export type Topic = (typeof TOPICS)[number];

export const AUDIENCES = [
  'families',
  'infants-i-joves',
  'gent-gran',
  'dones',
] as const;
export type Audience = (typeof AUDIENCES)[number];

/** Reviewed source categories whose courses all belong to one topic. */
const topicCategories: Record<Exclude<Topic, 'altres'>, readonly string[]> = {
  'arts-i-manualitats': [
    'ART I CREATIVITAT',
    'ART I DISSENY',
    'ARTS PLÀSTIQUES',
    'PLÀSTICA',
    'FET A MÀ',
    'Arts Plàstiques i Visuals',
    'ARTS VISUALS I PLÀSTIQUES',
    '2- ARTS VISUALS I PLÀSTIQUES',
    'ARTS PLÀSTIQUES I ARTS VISUALS',
    'Arts visuals',
    'FARINERA ART I CREACIÓ',
    'Art tèxtil',
    'Artesania',
    'ARTESANIA, TÈXTIL I ARTS DECORATIVES',
    '3- ARTESANIA, TÈXTIL I ARTS DECO.',
    "ISA: FESTIVAL D'IL·LUSTRACIÓ",
    'Tallers artístics',
    'RECURSOS - CREATIVITAT - FET A MÀ',
    'Dibuix, còmic i il·lustració',
    'Artes plásticas',
  ],
  'fotografia-i-audiovisual': [
    'FOTOGRAFIA',
    'ESPAI FOTOGRÀFIC',
    'ESPAI FOTOGRÀFIC PATI LLIMONA',
    'Espai de fotografia F. Català-Roca',
    'FOTOGRAFÍA I NOVES TECNOLOGIES',
    'LABarraca_LAB',
    'Audiovisual i fotografia',
    'CINEMA',
    'Ràdio i pòdcast',
    'Cine',
    'Imagen y sonido',
  ],
  musica: [
    'MÚSICA',
    'MÚSICA I VEU',
    'MUSICA I VEU',
    'Música i cant',
    'EXPRESSIÓ MUSICAL',
  ],
  dansa: [
    'BALL',
    'DANSA',
    'Danses',
    'BALLS I DANSES',
    'Dansa i balls',
    'Dansa i moviment',
    'Dansa i expressió corporal',
    'BALL I MOVIMENT',
    'MOVIMENT, EXPRESSIÓ I DANSES',
    '7- ARTS ESCÈNIQUES I BALL',
  ],
  teatre: [
    'TEATRE',
    'ARTS ESCÈNIQUES',
    'Teatre i interpretació',
    'Teatre i recursos teatrals',
    'ENTORN DE LES ARTS ESCÈNIQUES',
    "Escola d'Arts Escèniques Tísner (4 a 17 anys)",
    'CIRC',
    'Teatro y Artes Escénicas',
  ],
  'activitat-fisica': [
    'ACTIVITAT FÍSICA',
    'ACTIVITAT FÍSICA I BENESTAR',
    'SALUT',
    'SALUT I BENESTAR',
    'SALUT I BENESTAR FÍSIC',
    'SALUT I ACTIVITAT FÍSICA',
    '1- SALUT I ACTIVITAT FÍSICA',
    'SALUT I CREIXEMENT PERSONAL : Activitats físiques que afavoreixen la salut',
    'COS',
    'COS I MENT',
    'FARINERA COS I MENT',
    'Benestar',
    'Benestar personal',
    'Deporte',
  ],
  benestar: [
    'Creixement personal',
    'SALUT I BENESTAR EMOCIONAL',
    'Desarrollo personal',
  ],
  cuina: [
    'CUINA',
    'GASTRONOMIA',
    'CUINA I GASTRONOMIA',
    'GASTRONOMIA I ALIMENTACIÓ',
    '9- GASTRONOMIA I ALIMENTACIÓ',
    'CUINA I NUTRICIÓ',
    'Cuina sostenible',
    'Puntuals de cuina',
    'A taula! Tallers de cuina',
  ],
  idiomes: ['IDIOMES', 'LLENGÜES', '4- LLENGÜES', 'Idiomas'],
  'humanitats-i-ciencia': [
    'HUMANITATS',
    'CIÈNCIES I HUMANITATS',
    'Humanitats i Ciències socials',
    'HUMANÍSTICS I CIÈNCIES SOCIALS',
    'Humanitats i Cultura',
    'HUMANITATS, HISTÒRIA I CULTURA',
    'Història',
    'Actualitat i història',
    'Antropologia',
    'Art i pensament',
    'Ciència',
    'Natura i ciència',
    'Astronomia',
    'Sessions de Planetari | Familiars',
    'CREACIÓ LITERÀRIA',
    'EL MON DE LA PARAULA',
    'Itineraris',
    'SORTIDES',
    'VISITES CULTURALS,VISITES GUIADES, SORTIDES i EXCURSIONS',
    'Espai Dona',
  ],
  tecnologia: [
    'NOVES TECNOLOGIES',
    'Noves tecnologies i TIC',
    'INFORMÀTICA',
    'INFORMÀTICA I MULTIMEDIA',
    'INFORMÀTICA I COMUNITAT DIGITAL',
    'Tecnologia digital',
    'Maker',
    'MakerLab',
    'Creació Visual i Sonora',
    '1_Tallers de creació multimèdia i maker',
    "4_Tallers d'informàtica per a gent gran",
    '3_Tallers de fabricació digital i robòtica per infants, adolescents i joves',
  ],
  natura: [
    'Medi ambient',
    'Sostenibilitat i medi ambient',
    'Ecologia urbana i sostenibilitat',
    'Ciència i Natura',
    'Ciència, natura i medi ambient',
    'Hort al balcó',
    'Aula Ambiental',
    "Itineraris d'Aula Ambiental",
    'MÉS ECO',
  ],
};

/**
 * Reviewed source categories that mix topics or name an audience, format or
 * programme instead. Their courses are classified by title.
 */
const mixedCategories: readonly string[] = [
  'Formación',
  'Otros',
  'EXPRESSIÓ',
  'Expressió i creativitat',
  'EXPRESSIÓ CREATIVA',
  'EXPRESSIÓ-Teatre,Dansa ...',
  'Expressió i Moviment',
  'CREATIVITAT',
  'CREATIVITAT-Dibuix, Manualitats, Fotografia ...',
  'Art i creació',
  'Arts creatives',
  'Arts i benestar',
  'RECURSOS',
  'RECURSOS I CREATIVITAT',
  'Recursos i humanitats',
  'RECURSOS PERSONALS',
  'RECURSOS-Faciliten Recursos Personals',
  'HABILITATS I COMPETÈNCIES',
  'SALUT I CREIXEMENT PERSONAL',
  'SALUT I ESPORT',
  'Cos i moviment',
  'Cos, Ment i Dansa',
  'Música, dansa i teatre',
  'ARTS ESCÈNIQUES I BALLS',
  'ARTS ESCÈNIQUES I DANSA',
  'ARTS ESCÈNIQUES: DANSES I TEATRE',
  'Escola de Flamenc',
  '(in)fusión flamenca',
  'ESPECIALITZACIÓ DE JAZZ',
  'ESPECIALITZACIÓ DE MEDI AMBIENT',
  'Creació i tecnologia',
  'Ciència, tecnologia i urbanisme',
  'COMUNITAT DIGITAL',
  'PARAULA',
  'Comunicació',
  'CULTURA',
  'INNOVACIÓ SOCIAL',
  'Fes-ho per tu',
  'Autoaprenentatge per cooperació veinal',
  'COMUNITARI',
  'Tallers per a adults',
  'Tallers nous de tardor',
  'CÀPSULES',
  '92- CÀPSULES',
  'SEMINARIS',
  'MONOGRÀFICS',
  'Monografics',
  'WORKSHOPS',
  '93-VIU EL DISSABTE!',
  "TROBA'T",
  '#FEMBARRI',
  '#elravalésverd',
  'Ravalejant',
  "ReGENERA'T",
  '25N',
  'DONA',
  'Altres',
  // Audience categories (see `audienceCategories`).
  'FAMILIARS',
  'ACTIVITATS FAMILIARS',
  'TALLERS FAMILIARS',
  'Tallers en família',
  'TALLER EN FAMÍLIA',
  'En família',
  'EN FAMÍLIA-Realitzats amb la família',
  'Cursos en família',
  'Puntuals Familiars',
  'Tallers per a infants i families',
  'Infantil i familiar',
  'Infants',
  'Infantils',
  'Tallers Infantil',
  'INFANTILS i JUVENILS',
  'Infants i joves',
  'PER INFANTS I JOVES',
  '91- INFANTS I JOVES',
  'Tallers per a Infants i Joves',
  'T. PER INFANTS, ADOLES. I JOVES',
  'TALLERS PER A INFANTS, ADOLESCENTS I JOVES',
  'Adolescents i Joves',
  'Joves',
  'Tallers Joves',
  'GENT GRAN',
  'Persones Grans',
  'ESPECIAL GENT GRAN',
];

/** Reviewed source categories that name who the courses are for. */
const audienceCategories: Record<Audience, readonly string[]> = {
  families: [
    'FAMILIARS',
    'ACTIVITATS FAMILIARS',
    'TALLERS FAMILIARS',
    'Tallers en família',
    'TALLER EN FAMÍLIA',
    'En família',
    'EN FAMÍLIA-Realitzats amb la família',
    'Cursos en família',
    'Puntuals Familiars',
    'Tallers per a infants i families',
    'Infantil i familiar',
    'Sessions de Planetari | Familiars',
  ],
  'infants-i-joves': [
    'Infants',
    'Infantils',
    'Tallers Infantil',
    'INFANTILS i JUVENILS',
    'Infants i joves',
    'PER INFANTS I JOVES',
    '91- INFANTS I JOVES',
    'Tallers per a Infants i Joves',
    'T. PER INFANTS, ADOLES. I JOVES',
    'TALLERS PER A INFANTS, ADOLESCENTS I JOVES',
    'Adolescents i Joves',
    'Joves',
    'Tallers Joves',
    "Escola d'Arts Escèniques Tísner (4 a 17 anys)",
    '3_Tallers de fabricació digital i robòtica per infants, adolescents i joves',
  ],
  'gent-gran': [
    'GENT GRAN',
    'Persones Grans',
    'ESPECIAL GENT GRAN',
    "4_Tallers d'informàtica per a gent gran",
  ],
  dones: ['DONA', 'Espai Dona'],
};

// Matched in order against the folded title (lowercase, no accents); the first match
// wins, so narrower topics come first ("fotografia amb el mòbil" is photography,
// "cuina japonesa" is cooking, "ball flamenc i àrab" is dance).
const titleTopicRules: readonly (readonly [Topic, RegExp])[] = [
  [
    'fotografia-i-audiovisual',
    /fotogra|\bfotos?\b|lightroom|\bcine|cinema|audiovisual|\bvideo|curtmetratge|radio|podcast/,
  ],
  [
    'cuina',
    /cuina|gastronom|recept|reboster|postres|aperitiu|canelons|galetes|cookies|torrons|bombons|xocolata|risotto|\bpans?\b|coques|panellets|dolcos|\bmenu\b/,
  ],
  [
    'musica',
    /music|\bcanta?r?\b|cante|\bcor\b|coral|guitarra|ukelele|piano|percussi|caixo|cajon|\bdj i\b|dj set|harmonica|palmes|combo|orquestra|vocal|\bveus?\b|\bband\b/,
  ],
  [
    'dansa',
    /dansa|danse|dance|afrobeat|heels|ritmes (llatins|caribenys)|twerk|xarleston|charleston|femme style|groove|jazz|coreograf|baila|\bballs?\b|\bbailes?\b|danza|balfolk|kpop|konpa|paloteado|ballet|sevillan|flamenc|salsa|swing|bollywood|country|claque|tango|bachata|burlesque|zumdance/,
  ],
  [
    'teatre',
    /teatr|\bimpro(?!ve)|clown|\bcirc\b|trapezi|\bteles\b|cabaret|interpretaci|titelles|bufo|escena/,
  ],
  [
    'idiomes',
    /angles|frances|alemany|italia|arab\b|castella\b|catala\b|\benglish|speak|deutsch|\bidiom|llengua|conversa (en|catala|castella)|grup de conversa|\bingles\b|aleman|espanol|alfabetizaci/,
  ],
  [
    'activitat-fisica',
    /\bioga|\biogu|yoga|pilates|txi.?kung|chi.?kung|tai\W*txi|\bgac\b|stretching|\bbarre\b|feldenkrais|balance flow|moviment conscient|tecniques de moviment|en forma|gimnas(?!tica mental|ia cerebral)|estiraments|tonifica|aerobic|marxa nordica|running|hipopressiv|sol pelvia|fitness|zumba|tennis|ping pong|arts marcials|autodefensa|defensa personal|esquena|postural|\bforca\b|manteniment/,
  ],
  [
    'benestar',
    /mindfulness|\bmental|medita|\bment\b|respira|psicolog|sensibilitat|qui soc|terapi|dolor cronic|memoria|activa.?ment|cervell|relaxaci|estres|emocio|autoajuda|creixement|risoterap|autoestima|ansietat|assertiv|menopausa/,
  ],
  [
    'tecnologia',
    /informatic|ordinador|telefon|fulls de calcul|touchdesigner|inventor|sonoritz|il.lumin|mobil|smartphone|tablet|tauletes|internet|digital|\bia\b|intel.ligencia artificial|chatgpt|windows|arduino|\b3d\b|robot|programaci|\bapps?\b|maker/,
  ],
  [
    'arts-i-manualitats',
    /ceramica|esmalt|color|sumi|cistell|sashiko|flor seca|lettering|diari visual|acrilic|enquadern|model viu|humor grafic|kintsugi|nerikomi|argila|\bfang\b|grafiques|scrapbook|patronatge|confecci|\bnino\b|xapa|garland|il.lustr|portagots|maquillatge|artesania|teixir|pinten|xampu|unguent|centre de taula|pintura|dibuix|aquarel|il.lustraci|sketching|costura|cosir|ganxet|\bmitja|patchwork|macrame|brodat|punt de creu|joieria|bijuteria|resina|serigrafia|collage|fanzin|manga|comic|restauraci|floral|espelmes|decoraci|feltre|origami|tiffany|manualitat|estampaci|retrat|puntes|cosmetica|sabo\b|colonies|perfum|bricolatge|tex?til|roba/,
  ],
  [
    'natura',
    /\bhort|jardi|plantes|botanic|natura|ornitolog|senderisme|kokedam|bolets|remeis|cactus|sostenib|medi ambient/,
  ],
  [
    'humanitats-i-ciencia',
    /histor|contes|cementiri|cronica|narra|ficcio|editorial|lector|filosof|literar|literatur|escriptura|escritura|tertulia|escriu|llibre|lectura|poesia|museu|exposici|\bruta\b|visita|itinerari|antropolog|cienci|neurocien|astronom|univers|cultur/,
  ],
];

const titleAudienceRules: readonly (readonly [Audience, RegExp])[] = [
  [
    'families',
    /en famili|\bfamilies\b|taller familiar|educativos? familiar|familiar \(|nadons|mares i/,
  ],
  [
    'gent-gran',
    /gent gran|persones grans|personas mayores|tertulia mayores|\bsenior\b|envejecimiento|\+ ?6[05]\b/,
  ],
  [
    'infants-i-joves',
    /infant|\bnens\b|\bnenes\b|\bjoves\b|\bninos\b|\bninas\b|\bjoven(es)?\b|adolescent|\bkids\b|junior|\d+ ?(a|-) ?\d+ anys|a partir de \d+ anys/,
  ],
  [
    'dones',
    /per a (la )?(dona|dones)\b|para mujeres|no mixta|autodefensa feminista|empoderament femeni/,
  ],
];

function comparisonKey(value: string): string {
  return value
    .normalize('NFC')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLocaleUpperCase('ca');
}

/**
 * Reviewed categories that name a topic but also hold courses of the listed topics
 * (Zaragoza's "Música" and "Deporte" include dance classes). A title rule for one of
 * those topics wins; otherwise the category's topic stands. Keys match like the tables.
 */
const titleRefinements: Readonly<Record<string, readonly Topic[]>> = {
  MÚSICA: ['dansa'],
  Deporte: ['dansa'],
  'Desarrollo personal': ['activitat-fisica'],
};

/** Source category key → topic, or null when the title decides. */
const categoryTopics = new Map<string, Topic | null>([
  ...Object.entries(topicCategories).flatMap(([topic, categories]) =>
    categories.map(
      (category) => [comparisonKey(category), topic as Topic] as const,
    ),
  ),
  ...mixedCategories.map(
    (category) => [comparisonKey(category), null] as const,
  ),
]);

const refinements = new Map(
  Object.entries(titleRefinements).map(
    ([category, topics]) =>
      [
        comparisonKey(category),
        titleTopicRules.filter(([topic]) => topics.includes(topic)),
      ] as const,
  ),
);

const categoryAudiences = new Map<string, Audience>(
  Object.entries(audienceCategories).flatMap(([audience, categories]) =>
    categories.map(
      (category) => [comparisonKey(category), audience as Audience] as const,
    ),
  ),
);

const topicSet: ReadonlySet<string> = new Set(TOPICS);
export const isTopic = (value: string): value is Topic => topicSet.has(value);
const audienceSet: ReadonlySet<string> = new Set(AUDIENCES);
export const isAudience = (value: string): value is Audience =>
  audienceSet.has(value);

interface Classifiable {
  category: string | null;
  title: string;
}

function byTitle<T>(
  rules: readonly (readonly [T, RegExp])[],
  title: string,
): T | null {
  const folded = foldText(title);
  return rules.find(([, pattern]) => pattern.test(folded))?.[0] ?? null;
}

/** The one topic a course is listed under; never guessed beyond the reviewed rules. */
export function courseTopic({ category, title }: Classifiable): Topic {
  const key = category ? comparisonKey(category) : null;
  const mapped = key ? categoryTopics.get(key) : null;
  const refined = key ? refinements.get(key) : undefined;
  if (mapped && refined) return byTitle(refined, title) ?? mapped;
  return mapped ?? byTitle(titleTopicRules, title) ?? 'altres';
}

/** Who a course is for, when its category or title says so. */
export function courseAudience({
  category,
  title,
}: Classifiable): Audience | null {
  return (
    (category ? categoryAudiences.get(comparisonKey(category)) : undefined) ??
    byTitle(titleAudienceRules, title)
  );
}

/** Source categories not yet reviewed into the tables above, for the freshness report. */
export function unmappedCategories(categories: Iterable<string>): string[] {
  return [
    ...new Set(
      [...categories].filter(
        (category) => !categoryTopics.has(comparisonKey(category)),
      ),
    ),
  ].sort();
}
