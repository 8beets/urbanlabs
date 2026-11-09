export interface Centre {
  id: string;
  slug: string;
  name: string;
  address: string;
  city: string;
  country: string;
  official_url: string;
  description: string | null;
  description_language: string | null;
  phone: string | null;
  email: string | null;
  details_source_url: string | null;
  details_verified_at: string | null;
  notice: 'temporary_closure' | null;
  latitude: number | null;
  longitude: number | null;
  coordinates_source_url: string | null;
  coordinates_verified_at: string | null;
}

const columns = `i.id, p.slug, i.name, i.address, i.city, i.country, i.official_url,
 p.description, p.description_language, p.phone, p.email, p.details_source_url, p.details_verified_at, p.notice,
 p.latitude, p.longitude, p.coordinates_source_url, p.coordinates_verified_at`;
export const CENTRES_PAGE_SIZE = 24;

// shortcut: the directory filters and pages this list in memory, fine for hundreds of
// centres; move to indexed SQL search if the registry grows past CENTRES_LIMIT.
export const CENTRES_LIMIT = 1000;

export async function listInstitutions(db: D1Database): Promise<Centre[]> {
  const result = await db
    .prepare(
      `SELECT ${columns} FROM institutions i
    JOIN institution_profiles p ON p.institution_id=i.id
    ORDER BY i.name, i.id LIMIT ?`,
    )
    .bind(CENTRES_LIMIT)
    .all<Centre>();
  return result.results;
}

export async function findInstitution(
  db: D1Database,
  slug: string,
): Promise<Centre | null> {
  const result = await db
    .prepare(
      `SELECT ${columns} FROM institution_profiles p
    JOIN institutions i ON i.id=p.institution_id WHERE p.slug=? LIMIT 1`,
    )
    .bind(slug)
    .all<Centre>();
  return result.results[0] ?? null;
}

export interface CentreMapPoint {
  id: string;
  slug: string;
  name: string;
  latitude: number;
  longitude: number;
}

export const MAP_CENTRES_LIMIT = 500;

export async function listMapCentres(db: D1Database) {
  const result = await db
    .prepare(
      `SELECT i.id, p.slug, i.name, p.latitude, p.longitude
    FROM institution_profiles p JOIN institutions i ON i.id=p.institution_id
    WHERE p.latitude BETWEEN -90 AND 90 AND p.longitude BETWEEN -180 AND 180
      AND p.coordinates_source_url LIKE 'https://%'
      AND p.coordinates_verified_at IS NOT NULL AND p.coordinates_verified_at <> ''
    ORDER BY i.name, i.id LIMIT ?`,
    )
    .bind(MAP_CENTRES_LIMIT + 1)
    .all<CentreMapPoint>();
  return {
    mapCentres: result.results.slice(0, MAP_CENTRES_LIMIT),
    mapHasMore: result.results.length > MAP_CENTRES_LIMIT,
  };
}
