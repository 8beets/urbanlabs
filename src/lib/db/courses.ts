import type { IngestionDatabase } from './ingestion-port';
import type { NewCourse } from '../alerts/subscription';

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
