import { foldText } from '../catalog/title-match';
// The explicit attribute is required by the Worker dev runtime (workerd) and Node.
import data from '../../../data/categories.json' with { type: 'json' };
import type { ReviewedCategories } from './category-tables';

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

export function comparisonKey(value: string): string {
  return value
    .normalize('NFC')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLocaleUpperCase('ca');
}

// data/categories.json, described in category-tables.ts. tests/unit/categories.test.ts
// validates it there, so zod stays out of the browser bundle.
const reviewed = data as ReviewedCategories;

/** Source category key → topic, or null when the title decides. */
const categoryTopics = new Map<string, Topic | null>([
  ...Object.entries(reviewed.topics).flatMap(([topic, categories]) =>
    categories.map(
      (category) => [comparisonKey(category), topic as Topic] as const,
    ),
  ),
  ...reviewed.mixed.map((category) => [comparisonKey(category), null] as const),
]);

const refinements = new Map(
  Object.entries(reviewed.refinements).map(
    ([category, topics]) =>
      [
        comparisonKey(category),
        titleTopicRules.filter(([topic]) => topics.includes(topic)),
      ] as const,
  ),
);

const categoryAudiences = new Map<string, Audience>(
  Object.entries(reviewed.audiences).flatMap(([audience, categories]) =>
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

/** Source categories not yet reviewed into data/categories.json, for the freshness report. */
export function unmappedCategories(categories: Iterable<string>): string[] {
  return [
    ...new Set(
      [...categories].filter(
        (category) => !categoryTopics.has(comparisonKey(category)),
      ),
    ),
  ].sort();
}
