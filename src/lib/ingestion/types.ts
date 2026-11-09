export type SourcePlatform = 'miram' | 'alicante-aula-abierta';

export interface SourceConfig {
  id: string;
  /** Selects the adapter; institution-specific values stay in this config. */
  platform: SourcePlatform;
  name: string;
  listingUrl: string;
  excludedCategoryCodes?: string[];
  excludedExternalIds?: string[];
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
  courseLanguage: null;
}

export interface SourceAdapter {
  fetchRecords(source: SourceConfig): Promise<CourseRecord[]>;
}
