export type SourcePlatform =
  | 'miram'
  | 'alicante-aula-abierta'
  | 'tarragona-centres-civics'
  | 'zaragoza-centros-civicos'
  | 'girona-centres-civics'
  | 'vitoria-gasteiz-actividades';

export interface SourceConfig {
  id: string;
  /** Selects the adapter; institution-specific values stay in this config. */
  platform: SourcePlatform;
  name: string;
  listingUrl: string;
  excludedCategoryCodes?: string[];
  excludedExternalIds?: string[];
  /** The centre's number on its platform (Tarragona activity codes, Zaragoza `idLugar`, Vitoria `cen`). */
  centreCode?: number;
  /** Girona and Vitoria-Gasteiz: the centre's venue name; Girona: the activity-code prefix of the courses it runs elsewhere. */
  venue?: string;
  codePrefix?: string;
  /** An empty listing is a valid, successful snapshot (seasonal centres). */
  mayBeEmpty?: boolean;
  institution: {
    id: string;
    name: string;
    url: string;
    city: string;
    cityId: string;
    country: string;
    address: string;
    timezone: string;
  };
}

export interface CourseRecord {
  externalId: string;
  title: string;
  officialUrl: string;
  category: string | null;
  startDate: string | null;
  endDate: string | null;
  scheduleText: string | null;
  priceCents: number | null;
  currency: 'EUR' | null;
  availability: null;
  isCancelled: boolean;
  /** True only when the source explicitly reports no places left. */
  isSoldOut: boolean;
  /** Entity running the course when the source names one other than the centre. */
  organizer?: string | null;
  courseLanguage: null;
}

export interface SourceAdapter {
  fetchRecords(source: SourceConfig): Promise<CourseRecord[]>;
}
