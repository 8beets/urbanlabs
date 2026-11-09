import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { Centre } from './schema';
import type { SourceStatus } from '../ingestion/plan';

export interface FreshnessOptions {
  now: Date;
  /** Reviewed profile data (details, coordinates, registration) older than this is due. */
  maxProfileAgeDays: number;
  /** A source without a successful run for this long is likely broken or drifted. */
  maxSourceAgeDays: number;
}

export interface StaleProfile {
  centreId: string;
  field: 'details' | 'location' | 'registration';
  verifiedAt: string;
  ageDays: number;
}
export interface StaleSource {
  id: string;
  lastSuccessAt: string | null;
  ageDays: number | null;
}
export interface FreshnessReport {
  profiles: StaleProfile[];
  sources: StaleSource[];
}

/** Pure check: which reviewed data and which sources need a maintainer's attention. */
export function checkFreshness(
  centres: Centre[],
  statuses: SourceStatus[],
  options: FreshnessOptions,
): FreshnessReport {
  const age = (iso: string) =>
    differenceInCalendarDays(options.now, parseISO(iso));
  const profiles = centres.flatMap((centre) =>
    (
      [
        ['details', centre.profile.detailsVerifiedAt],
        ['location', centre.profile.location?.verifiedAt],
        ['registration', centre.registration.verifiedAt],
      ] as const
    ).flatMap(([field, verifiedAt]) =>
      verifiedAt && age(verifiedAt) > options.maxProfileAgeDays
        ? [{ centreId: centre.id, field, verifiedAt, ageDays: age(verifiedAt) }]
        : [],
    ),
  );
  const sources = statuses.flatMap((status) => {
    const ageDays =
      status.lastSuccessAt === null ? null : age(status.lastSuccessAt);
    return ageDays === null || ageDays > options.maxSourceAgeDays
      ? [{ id: status.id, lastSuccessAt: status.lastSuccessAt, ageDays }]
      : [];
  });
  return { profiles, sources };
}

/** Markdown for the tracking issue, or null when everything is fresh. */
export function renderFreshnessReport(
  report: FreshnessReport,
  options: Pick<FreshnessOptions, 'maxProfileAgeDays' | 'maxSourceAgeDays'>,
): string | null {
  if (!report.profiles.length && !report.sources.length) return null;
  const lines: string[] = [];
  if (report.sources.length) {
    lines.push(
      `## Sources without a successful import in over ${options.maxSourceAgeDays} days`,
      '',
      'Check the latest "Scheduled ingestion" run: the source may be empty, down, or its markup may have changed.',
      '',
      ...report.sources.map(
        (s) =>
          `- \`${s.id}\`: ${s.lastSuccessAt === null ? 'never imported' : `last success ${s.lastSuccessAt} (${s.ageDays} days ago)`}`,
      ),
      '',
    );
  }
  if (report.profiles.length) {
    lines.push(
      `## Reviewed centre data older than ${options.maxProfileAgeDays} days`,
      '',
      'Re-check against the official source, then update the date in `data/centres/`.',
      '',
      ...report.profiles.map(
        (p) =>
          `- \`${p.centreId}\` ${p.field}: verified ${p.verifiedAt} (${p.ageDays} days ago)`,
      ),
      '',
    );
  }
  return lines.join('\n');
}
