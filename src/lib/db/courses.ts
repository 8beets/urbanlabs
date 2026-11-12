import {
  geographicCondition,
  type GeographicFilters,
} from '../locations/geography';
import { canonicalCategory } from '../courses/categories';
import type { DiscoveryFilters } from '../catalog/types';
import type { IngestionDatabase } from './ingestion-port';
import type { NewCourse } from '../alerts/subscription';

export async function listCategories(
  db: D1Database,
  today: string,
  centre = '',
  geography: GeographicFilters &
    Pick<DiscoveryFilters, 'cancellation' | 'archive'> = {},
): Promise<string[]> {
  const geographic = geographicCondition(geography, 'c.institution_id');
  // Driven by the live-edition range, so the cost follows live editions, not history.
  const result = await db
    .prepare(
      `SELECT DISTINCT c.category FROM course_editions e
    JOIN courses c ON c.id=e.course_id
    WHERE e.live_until ${geography.archive ? '<' : '>='} ? ${cancellationCondition(geography.cancellation)}
    AND c.category IS NOT NULL AND c.category <> ''
    ${centre ? 'AND c.institution_id = ?' : ''} ${geographic.sql ? `AND ${geographic.sql}` : ''}
    ORDER BY c.category LIMIT 100`,
    )
    .bind(today, ...(centre ? [centre] : []), ...geographic.values)
    .all<{ category: string }>();
  return [
    ...new Set(result.results.map((row) => canonicalCategory(row.category))),
  ].sort();
}

function cancellationCondition(
  value: DiscoveryFilters['cancellation'],
): string {
  return value === 'hide'
    ? 'AND e.is_cancelled=0'
    : value === 'only'
      ? 'AND e.is_cancelled=1'
      : '';
}

export const NEW_COURSES_LIMIT = 2000;
/**
 * Live, non-cancelled editions first seen after `since`, newest first, for the alert
 * digest. One bounded scan of the source_records_first_seen index serves every
 * subscription in a run; matching by category and city happens in memory.
 */
export async function listNewCourses(
  db: IngestionDatabase,
  since: string,
  today: string,
): Promise<{ courses: NewCourse[]; truncated: boolean }> {
  const result = await db
    .prepare(
      `SELECT e.id, coalesce(c.reviewed_title, c.title) AS title, c.category,
      il.city_id, i.name AS institution, e.start_date, e.schedule_text,
      sr.official_url, sr.first_seen_at
    FROM source_records sr
    JOIN course_editions e ON e.id=sr.edition_id
    JOIN courses c ON c.id=e.course_id JOIN institutions i ON i.id=c.institution_id
    LEFT JOIN institution_locations il ON il.institution_id=i.id
    WHERE sr.first_seen_at > ? AND e.is_cancelled=0 AND +e.live_until >= ?
    ORDER BY sr.first_seen_at DESC, sr.source_id, sr.external_id LIMIT ?`,
    )
    .bind(since, today, NEW_COURSES_LIMIT + 1)
    .all<{
      id: string;
      title: string;
      category: string | null;
      city_id: string | null;
      institution: string;
      start_date: string | null;
      schedule_text: string | null;
      official_url: string;
      first_seen_at: string;
    }>();
  return {
    truncated: result.results.length > NEW_COURSES_LIMIT,
    courses: result.results.slice(0, NEW_COURSES_LIMIT).map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      cityId: row.city_id,
      institution: row.institution,
      startDate: row.start_date,
      scheduleText: row.schedule_text,
      officialUrl: row.official_url,
      firstSeenAt: row.first_seen_at,
    })),
  };
}
