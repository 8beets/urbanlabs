export interface SourceConfig {
  id: string;
  name: string;
  listingUrl: string;
  excludedCategoryCodes?: string[];
  excludedExternalIds?: string[];
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
  courseLanguage: null;
}

export interface SourceAdapter {
  fetchRecords(source: SourceConfig): Promise<CourseRecord[]>;
}
