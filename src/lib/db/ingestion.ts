import type { CourseRecord, SourceConfig } from '../ingestion/types';
import { cleanText, hash } from '../ingestion/normalization/values';
import type { IngestionDatabase, IngestionStatement } from './ingestion-port';
import { centreProfile } from '../institutions/profiles';

export async function registerSource(
  db: IngestionDatabase,
  source: SourceConfig,
): Promise<void> {
  const institution = source.institution;
  const profile = centreProfile(institution.id);
  await db.batch([
    db
      .prepare(
        `INSERT INTO institutions (id, name, official_url, city, country, address, timezone)
      VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,
      official_url=excluded.official_url, city=excluded.city, country=excluded.country,
      address=excluded.address, timezone=excluded.timezone
      WHERE name IS NOT excluded.name OR official_url IS NOT excluded.official_url
        OR city IS NOT excluded.city OR country IS NOT excluded.country
        OR address IS NOT excluded.address OR timezone IS NOT excluded.timezone`,
      )
      .bind(
        institution.id,
        institution.name,
        institution.url,
        institution.city,
        institution.country,
        institution.address,
        institution.timezone,
      ),
    db
      .prepare(
        `INSERT INTO institution_locations(institution_id,country_code,city_id) VALUES (?,?,?)
      ON CONFLICT(institution_id) DO UPDATE SET country_code=excluded.country_code,city_id=excluded.city_id
      WHERE country_code IS NOT excluded.country_code OR city_id IS NOT excluded.city_id`,
      )
      .bind(institution.id, institution.country, institution.cityId),
    db
      .prepare(
        `INSERT INTO sources (id, institution_id, name, listing_url) VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, listing_url=excluded.listing_url
      WHERE name IS NOT excluded.name OR listing_url IS NOT excluded.listing_url`,
      )
      .bind(source.id, institution.id, source.name, source.listingUrl),
    db
      .prepare(
        `INSERT INTO institution_profiles
      (institution_id, slug, description, description_language, phone, email, details_source_url, details_verified_at, notice,
       latitude, longitude, coordinates_source_url, coordinates_verified_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(institution_id) DO UPDATE SET slug=excluded.slug,
      description=coalesce(excluded.description, institution_profiles.description),
      description_language=coalesce(excluded.description_language, institution_profiles.description_language),
      phone=coalesce(excluded.phone, institution_profiles.phone), email=coalesce(excluded.email, institution_profiles.email),
      details_source_url=coalesce(excluded.details_source_url, institution_profiles.details_source_url),
      details_verified_at=coalesce(excluded.details_verified_at, institution_profiles.details_verified_at),
      notice=CASE WHEN ?=1 THEN excluded.notice ELSE institution_profiles.notice END,
      latitude=coalesce(excluded.latitude, institution_profiles.latitude), longitude=coalesce(excluded.longitude, institution_profiles.longitude),
      coordinates_source_url=coalesce(excluded.coordinates_source_url, institution_profiles.coordinates_source_url),
      coordinates_verified_at=coalesce(excluded.coordinates_verified_at, institution_profiles.coordinates_verified_at)
      WHERE slug IS NOT excluded.slug
        OR description IS NOT coalesce(excluded.description, description)
        OR description_language IS NOT coalesce(excluded.description_language, description_language)
        OR phone IS NOT coalesce(excluded.phone, phone) OR email IS NOT coalesce(excluded.email, email)
        OR details_source_url IS NOT coalesce(excluded.details_source_url, details_source_url)
        OR details_verified_at IS NOT coalesce(excluded.details_verified_at, details_verified_at)
        OR notice IS NOT (CASE WHEN ?=1 THEN excluded.notice ELSE notice END)
        OR latitude IS NOT coalesce(excluded.latitude, latitude) OR longitude IS NOT coalesce(excluded.longitude, longitude)
        OR coordinates_source_url IS NOT coalesce(excluded.coordinates_source_url, coordinates_source_url)
        OR coordinates_verified_at IS NOT coalesce(excluded.coordinates_verified_at, coordinates_verified_at)`,
      )
      .bind(
        institution.id,
        profile.slug,
        profile.description ?? null,
        profile.descriptionLanguage ?? null,
        profile.phone ?? null,
        profile.email ?? null,
        profile.detailsSourceUrl ?? null,
        profile.detailsVerifiedAt ?? null,
        profile.notice ?? null,
        profile.location?.latitude ?? null,
        profile.location?.longitude ?? null,
        profile.location?.sourceUrl ?? null,
        profile.location?.verifiedAt ?? null,
        profile.notice === undefined ? 0 : 1,
        profile.notice === undefined ? 0 : 1,
      ),
  ]);
}

export async function saveSnapshot(
  db: IngestionDatabase,
  source: SourceConfig,
  records: CourseRecord[],
  runId: string,
  now: string,
): Promise<void> {
  const statements: IngestionStatement[] = [];
  const existing = await db
    .prepare(
      `SELECT sr.external_id, e.course_id FROM source_records sr
    JOIN course_editions e ON e.id=sr.edition_id WHERE sr.source_id=?`,
    )
    .bind(source.id)
    .all<{ external_id: string; course_id: string }>();
  const existingCourseIds = new Map(
    existing.results.map((row) => [row.external_id, row.course_id]),
  );
  for (const record of records) {
    // Conservative exact-title identity. Similar titles are never merged automatically.
    const courseId =
      existingCourseIds.get(record.externalId) ??
      (await hash(
        `${source.institution.id}\n${cleanText(record.title).normalize('NFC').toLocaleLowerCase('ca')}`,
      ));
    const editionId = await hash(`${source.id}\n${record.externalId}`);
    const payload = JSON.stringify(record);
    const contentHash = await hash(payload);
    statements.push(
      db
        .prepare(
          `INSERT INTO courses (id, institution_id, title, category, course_language) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET title=excluded.title, category=excluded.category, course_language=excluded.course_language
        WHERE title IS NOT excluded.title OR category IS NOT excluded.category
          OR course_language IS NOT excluded.course_language`,
        )
        .bind(
          courseId,
          source.institution.id,
          record.title,
          record.category,
          record.courseLanguage,
        ),
      db
        .prepare(
          `INSERT INTO course_editions (id, course_id, start_date, end_date, schedule_text, timezone, price_cents, currency, availability, is_cancelled, is_sold_out)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET course_id=excluded.course_id,
        start_date=excluded.start_date, end_date=excluded.end_date, schedule_text=excluded.schedule_text,
        price_cents=excluded.price_cents, currency=excluded.currency, availability=excluded.availability,
        is_cancelled=excluded.is_cancelled, is_sold_out=excluded.is_sold_out
        WHERE course_id IS NOT excluded.course_id OR start_date IS NOT excluded.start_date
          OR end_date IS NOT excluded.end_date OR schedule_text IS NOT excluded.schedule_text
          OR price_cents IS NOT excluded.price_cents OR currency IS NOT excluded.currency
          OR availability IS NOT excluded.availability OR is_cancelled IS NOT excluded.is_cancelled
          OR is_sold_out IS NOT excluded.is_sold_out`,
        )
        .bind(
          editionId,
          courseId,
          record.startDate,
          record.endDate,
          record.scheduleText,
          source.institution.timezone,
          record.priceCents,
          record.currency,
          record.availability,
          record.isCancelled ? 1 : 0,
          record.isSoldOut ? 1 : 0,
        ),
      db
        .prepare(
          `INSERT INTO source_records (source_id, external_id, edition_id, official_url, payload_json, content_hash, first_seen_at, last_seen_at, last_successfully_verified_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(source_id, external_id) DO UPDATE SET
        edition_id=excluded.edition_id, official_url=excluded.official_url, payload_json=excluded.payload_json,
        content_hash=excluded.content_hash, last_seen_at=excluded.last_seen_at,
        last_successfully_verified_at=excluded.last_successfully_verified_at`,
        )
        .bind(
          source.id,
          record.externalId,
          editionId,
          record.officialUrl,
          payload,
          contentHash,
          now,
          now,
          now,
        ),
    );
  }
  statements.push(
    db
      .prepare(
        `UPDATE ingestion_runs SET status='succeeded', finished_at=?, record_count=? WHERE id=?`,
      )
      .bind(now, records.length, runId),
  );
  // D1 batch is atomic: a failed statement rolls back records AND successful-run status.
  await db.batch(statements);
}
