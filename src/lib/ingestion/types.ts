import type { z } from 'zod';
import type { Centre } from '../centres/schema';
import type { courseRecordSchema } from './validation/record';

/** Derived from the registration schema, so a platform is declared once. */
export type SourcePlatform = Centre['registration']['platform'];

export interface SourceConfig {
  id: string;
  /** Selects the adapter; institution-specific values stay in this config. */
  platform: SourcePlatform;
  name: string;
  listingUrl: string;
  excludedCategoryCodes?: string[];
  excludedExternalIds?: string[];
  /** The centre's number on its platform (Tarragona activity codes, Zaragoza `idLugar`, Vitoria `cen`, Sabadell venue id, Málaga `ID_LUGAR`). */
  centreCode?: number;
  /** Girona and Vitoria-Gasteiz: the centre's venue name (El Prat: its page path); Girona: the activity-code prefix of the courses it runs elsewhere. */
  venue?: string;
  /** Miram hosts shared by several centres: texts one of which the card's "Espai" line must contain. */
  venues?: string[];
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

/** What an adapter returns for one course edition, before persistence. */
export type CourseRecord = z.infer<typeof courseRecordSchema>;

export interface SourceAdapter {
  fetchRecords(source: SourceConfig): Promise<CourseRecord[]>;
}
