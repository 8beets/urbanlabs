import {
  geographicCondition,
  type GeographicFilters,
} from '../locations/geography';
import { titleSearchMatch } from '../courses/title-search';
import { canonicalCategory, sourceCategories } from '../courses/categories';
import { monthRange } from '../courses/start-month';
import type { IngestionDatabase } from './ingestion-port';
import type { NewCourse } from '../alerts/subscription';

export interface DiscoveryFilters extends GeographicFilters {
  cancellation?: '' | 'hide' | 'only';
  /** 'available' hides editions the source reports as sold out. */
  places?: '' | 'available';
  /** Lists editions that have already ended instead of the live ones. */
  archive?: boolean;
  q: string;
  page: number;
  maxPriceCents: number | null;
  startMonth?: string;
  category: string;
  centre: string;
}
export interface CourseListing {
  id: string;
  title: string;
  title_reviewed: number;
  category: string | null;
  institution: string;
  institution_id: string;
  institution_slug: string;
  start_date: string | null;
  end_date: string | null;
  schedule_text: string | null;
  price_cents: number | null;
  currency: string | null;
  is_cancelled: number;
  is_sold_out: number;
  official_url: string;
  last_successfully_verified_at: string;
}
export const PAGE_SIZE = 12;

const courseColumns = `e.id, coalesce(c.reviewed_title, c.title) AS title,
  c.reviewed_title IS NOT NULL AS title_reviewed, c.category,
  i.name AS institution, i.id AS institution_id, coalesce(p.slug, i.id) AS institution_slug,
  e.start_date, e.end_date, e.schedule_text, e.price_cents, e.currency, e.is_cancelled, e.is_sold_out,
  sr.official_url, sr.last_successfully_verified_at`;

function canonicalListing(course: CourseListing): CourseListing {
  return {
    ...course,
    category:
      course.category === null ? null : canonicalCategory(course.category),
  };
}

export const LATEST_COURSES_LIMIT = 20;
export async function listLatestCourses(
  db: D1Database,
  today: string,
): Promise<CourseListing[]> {
  const result = await db
    .prepare(
      `SELECT ${courseColumns} FROM source_records sr
    JOIN course_editions e ON e.id=sr.edition_id
    JOIN courses c ON c.id=e.course_id JOIN institutions i ON i.id=c.institution_id
    LEFT JOIN institution_profiles p ON p.institution_id=i.id
    WHERE e.is_cancelled=0 AND +e.live_until >= ?
    ORDER BY sr.first_seen_at DESC, sr.source_id, sr.external_id LIMIT ?`,
    )
    .bind(today, LATEST_COURSES_LIMIT)
    .all<CourseListing>();
  return result.results.map(canonicalListing);
}

export async function listCourses(
  db: D1Database,
  filters: DiscoveryFilters,
  today: string,
): Promise<{ courses: CourseListing[]; hasNext: boolean }> {
  const conditions: string[] = [];
  const values: (string | number)[] = [];
  if (filters.cancellation === 'hide') conditions.push('e.is_cancelled=0');
  if (filters.cancellation === 'only') conditions.push('e.is_cancelled=1');
  const geographic = geographicCondition(filters);
  if (geographic.sql) {
    conditions.push(geographic.sql);
    values.push(...geographic.values);
  }
  if (filters.category) {
    const categories = sourceCategories(filters.category);
    conditions.push(`c.category IN (${categories.map(() => '?').join(', ')})`);
    values.push(...categories);
  }
  if (filters.centre) {
    conditions.push('c.institution_id = ?');
    values.push(filters.centre);
  }
  if (filters.q) {
    const match = titleSearchMatch(filters.q);
    // FTS5 folds case and accents; a query without letters or digits matches nothing.
    if (match === null) conditions.push('0=1');
    else {
      conditions.push(
        'c.id IN (SELECT course_id FROM courses_fts WHERE courses_fts MATCH ?)',
      );
      values.push(match);
    }
  }
  if (filters.maxPriceCents !== null) {
    conditions.push('e.price_cents <= ?');
    values.push(filters.maxPriceCents);
  }
  if (filters.places === 'available') conditions.push('e.is_sold_out=0');
  if (filters.startMonth) {
    // Editions without a start date never match: unknown dates are not inferred.
    const [from, to] = monthRange(filters.startMonth);
    conditions.push('e.start_date >= ? AND e.start_date < ?');
    values.push(from, to);
  }
  // Expired editions remain stored for provenance; they only appear in the archive.
  conditions.push(filters.archive ? 'e.live_until < ?' : 'e.live_until >= ?');
  values.push(today);
  const result = await db
    .prepare(
      `SELECT ${courseColumns} FROM course_editions e
    JOIN courses c ON c.id=e.course_id JOIN institutions i ON i.id=c.institution_id
    LEFT JOIN institution_profiles p ON p.institution_id=i.id
    JOIN source_records sr ON sr.edition_id=e.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY ${
      filters.archive
        ? 'e.live_until DESC, e.id'
        : 'e.is_cancelled, e.is_sold_out, e.start_date IS NULL, e.start_date, e.id'
    } LIMIT ? OFFSET ?`,
    )
    .bind(...values, PAGE_SIZE + 1, (filters.page - 1) * PAGE_SIZE)
    .all<CourseListing>();
  return {
    courses: result.results.slice(0, PAGE_SIZE).map(canonicalListing),
    hasNext: result.results.length > PAGE_SIZE,
  };
}

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

export interface CentreListing {
  id: string;
  name: string;
}
export async function listCentres(
  db: D1Database,
  today: string,
  geography: GeographicFilters &
    Pick<DiscoveryFilters, 'cancellation' | 'archive'> = {},
): Promise<CentreListing[]> {
  const geographic = geographicCondition(geography);
  const result = await db
    .prepare(
      `SELECT i.id, i.name FROM institutions i WHERE ${geographic.sql ? `${geographic.sql} AND` : ''}
    i.id IN (
      SELECT c.institution_id FROM course_editions e JOIN courses c ON c.id=e.course_id
      WHERE e.live_until ${geography.archive ? '<' : '>='} ? ${cancellationCondition(geography.cancellation)}
    ) ORDER BY i.name LIMIT 100`,
    )
    .bind(...geographic.values, today)
    .all<CentreListing>();
  return result.results;
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
