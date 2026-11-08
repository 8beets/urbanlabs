import { z } from 'zod';

export const centreProfileSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(3000).optional(),
  descriptionLanguage: z
    .string()
    .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/)
    .optional(),
  phone: z
    .string()
    .regex(/^[+0-9 ()-]{5,30}$/)
    .optional(),
  email: z.email().optional(),
  detailsSourceUrl: z.url().startsWith('https://').optional(),
  detailsVerifiedAt: z.iso.date().optional(),
  notice: z.literal('temporary_closure').nullable().optional(),
  location: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      sourceUrl: z.url().startsWith('https://'),
      verifiedAt: z.iso.date(),
    })
    .optional(),
});
export type CentreProfile = z.infer<typeof centreProfileSchema>;

// Manually reviewed metadata. No request-time geocoding or location inference.
export const verifiedCentreProfiles: Record<string, CentreProfile> = {
  'cc-sant-andreu': {
    slug: 'sant-andreu',
    phone: '933119953',
    detailsSourceUrl:
      'https://guia.barcelona.cat/ca/detall/centre-civic-sant-andreu_92086004879.html',
    detailsVerifiedAt: '2026-11-06',
    location: {
      latitude: 41.43088018380354,
      longitude: 2.1894124386376466,
      sourceUrl:
        'https://guia.barcelona.cat/ca/detall/centre-civic-sant-andreu_92086004879.html',
      verifiedAt: '2026-11-06',
    },
    email: 'infoccsa@bcn.cat',
  },
  'cc-can-baste': {
    slug: 'can-baste',
    phone: '934206651',
    detailsSourceUrl:
      'https://guia.barcelona.cat/ca/detall/centre-civic-can-baste_95124132926.html',
    detailsVerifiedAt: '2026-11-06',
    location: {
      latitude: 41.43045503743151,
      longitude: 2.173211965156838,
      sourceUrl:
        'https://guia.barcelona.cat/ca/detall/centre-civic-can-baste_95124132926.html',
      verifiedAt: '2026-11-06',
    },
    email: 'info@canbaste.com',
  },
  'cc-casa-elizalde': {
    slug: 'casa-elizalde',
    phone: '934880590',
    detailsSourceUrl:
      'https://guia.barcelona.cat/ca/detall/centre-cultural-la-casa-elizalde_92086007784.html',
    detailsVerifiedAt: '2026-11-06',
    location: {
      latitude: 41.394518975814755,
      longitude: 2.165900883899018,
      sourceUrl:
        'https://guia.barcelona.cat/ca/detall/centre-cultural-la-casa-elizalde_92086007784.html',
      verifiedAt: '2026-11-06',
    },
    email: 'casaelizalde@casaelizalde.com',
  },
  'cc-golferichs': {
    slug: 'golferichs',
    phone: '933237790',
    detailsSourceUrl:
      'https://guia.barcelona.cat/ca/detall/centre-civic-casa-golferichs_92086008869.html',
    detailsVerifiedAt: '2026-11-06',
    location: {
      latitude: 41.3808491471351,
      longitude: 2.1564074948215346,
      sourceUrl:
        'https://guia.barcelona.cat/ca/detall/centre-civic-casa-golferichs_92086008869.html',
      verifiedAt: '2026-11-06',
    },
    email: 'golferichs@golferichs.org',
  },
  'cc-el-sortidor': {
    slug: 'el-sortidor',
    phone: '934434311',
    detailsSourceUrl:
      'https://guia.barcelona.cat/ca/detall/centre-civic-el-sortidor_99120120846.html',
    detailsVerifiedAt: '2026-11-06',
    location: {
      latitude: 41.372098413253546,
      longitude: 2.162548299594534,
      sourceUrl:
        'https://guia.barcelona.cat/ca/detall/centre-civic-el-sortidor_99120120846.html',
      verifiedAt: '2026-11-06',
    },
    email: 'ccelsortidor@bcn.cat',
  },
  'cc-urgell': {
    slug: 'urgell',
    phone: '934536480',
    detailsSourceUrl:
      'https://guia.barcelona.cat/ca/detall/centre-civic-urgell_99400270324.html',
    detailsVerifiedAt: '2026-11-06',
    location: {
      latitude: 41.38689535147527,
      longitude: 2.152049712385728,
      sourceUrl:
        'https://guia.barcelona.cat/ca/detall/centre-civic-urgell_99400270324.html',
      verifiedAt: '2026-11-06',
    },
    email: 'info@ccurgell.cat',
  },
  'fab-casa-del-rellotge': {
    slug: 'fab-casa-del-rellotge',
    phone: '933 31 85 61',
    detailsSourceUrl:
      'https://guia.barcelona.cat/ca/detall/fab-casa-del-rellotge_99400176421.html',
    detailsVerifiedAt: '2026-11-06',
    location: {
      latitude: 41.35752484079787,
      longitude: 2.1412616272709113,
      sourceUrl:
        'https://guia.barcelona.cat/ca/detall/fab-casa-del-rellotge_99400176421.html',
      verifiedAt: '2026-11-06',
    },
    email: 'informacio@fabcasadelrellotge.cat',
  },
  'cc-pati-llimona': {
    slug: 'pati-llimona',
    phone: '932566100',
    detailsSourceUrl:
      'https://guia.barcelona.cat/ca/detall/centre-civic-pati-llimona_92086035951.html',
    detailsVerifiedAt: '2026-11-06',
    location: {
      latitude: 41.381668203042565,
      longitude: 2.1791887965465615,
      sourceUrl:
        'https://guia.barcelona.cat/ca/detall/centre-civic-pati-llimona_92086035951.html',
      verifiedAt: '2026-11-06',
    },
    email: 'ccpatillimona@patillimona.net',
  },
  'cc-albareda': {
    slug: 'albareda',
    phone: '934 433 719',
    detailsSourceUrl:
      'https://guia.barcelona.cat/ca/detall/centre-cultural-albareda_99400304670.html',
    detailsVerifiedAt: '2026-11-06',
    location: {
      latitude: 41.374005626997096,
      longitude: 2.1732617379790393,
      sourceUrl:
        'https://guia.barcelona.cat/ca/detall/centre-cultural-albareda_99400304670.html',
      verifiedAt: '2026-11-06',
    },
    email: 'ccalbareda@ccalbareda.cat',
  },
  'cc-vil-la-urania': {
    slug: 'vil-la-urania',
    phone: '937061295',
    detailsSourceUrl:
      'https://guia.barcelona.cat/ca/detall/centre-civic-vil-la-urania_99400179932.html',
    detailsVerifiedAt: '2026-11-06',
    location: {
      latitude: 41.40144911965885,
      longitude: 2.149816841793133,
      sourceUrl:
        'https://guia.barcelona.cat/ca/detall/centre-civic-vil-la-urania_99400179932.html',
      verifiedAt: '2026-11-06',
    },
    email: 'informacio@vilaurania.net',
  },
  'cc-fort-pienc': {
    slug: 'fort-pienc',
    phone: '932327827',
    detailsSourceUrl:
      'https://guia.barcelona.cat/ca/detall/centre-civic-ateneu-fort-pienc_99043134828.html',
    detailsVerifiedAt: '2026-11-08',
    location: {
      latitude: 41.395586587207276,
      longitude: 2.182465058010549,
      sourceUrl:
        'https://guia.barcelona.cat/ca/detall/centre-civic-ateneu-fort-pienc_99043134828.html',
      verifiedAt: '2026-11-08',
    },
    email: 'fortpienc@fortpienc.org',
  },
  'cc-barceloneta': {
    slug: 'barceloneta',
    phone: '932563300',
    detailsSourceUrl:
      'https://guia.barcelona.cat/ca/detall/centre-civic-barceloneta_94139083955.html',
    detailsVerifiedAt: '2026-11-08',
    location: {
      latitude: 41.38026816937647,
      longitude: 2.192288054869178,
      sourceUrl:
        'https://guia.barcelona.cat/ca/detall/centre-civic-barceloneta_94139083955.html',
      verifiedAt: '2026-11-08',
    },
    email: 'info@civicbarceloneta.com',
  },
  'cc-baro-de-viver': {
    slug: 'baro-de-viver',
    phone: '932565097',
    detailsSourceUrl:
      'https://guia.barcelona.cat/ca/detall/centre-civic-baro-de-viver_92086004979.html',
    detailsVerifiedAt: '2026-11-08',
    location: {
      latitude: 41.4462918208594,
      longitude: 2.200290194498161,
      sourceUrl:
        'https://guia.barcelona.cat/ca/detall/centre-civic-baro-de-viver_92086004979.html',
      verifiedAt: '2026-11-08',
    },
    email: 'ccbaroviver@bcn.cat',
  },
  'cc-can-castello': {
    slug: 'can-castello',
    phone: '932417874',
    detailsSourceUrl:
      'https://guia.barcelona.cat/ca/detall/centre-civic-can-castello_99400197043.html',
    detailsVerifiedAt: '2026-11-08',
    location: {
      latitude: 41.39900681458764,
      longitude: 2.1404013062330303,
      sourceUrl:
        'https://guia.barcelona.cat/ca/detall/centre-civic-can-castello_99400197043.html',
      verifiedAt: '2026-11-08',
    },
  },
  'fab-casa-del-mig': {
    slug: 'fab-casa-del-mig',
    phone: '932914262',
    detailsSourceUrl:
      'https://guia.barcelona.cat/ca/detall/fab-casa-del-mig-punt-multimedia-tancat_2043113906.html',
    detailsVerifiedAt: '2026-11-06',
    location: {
      latitude: 41.37749033167263,
      longitude: 2.140748141715598,
      sourceUrl:
        'https://guia.barcelona.cat/ca/detall/fab-casa-del-mig-punt-multimedia-tancat_2043113906.html',
      verifiedAt: '2026-11-06',
    },
    notice: 'temporary_closure',
    email: 'fabcasadelmig@fabcasadelmig.cat',
  },
};

export function centreProfile(institutionId: string): CentreProfile {
  return centreProfileSchema.parse(
    verifiedCentreProfiles[institutionId] ?? {
      slug: institutionId.replace(/^cc-/, ''),
    },
  );
}
