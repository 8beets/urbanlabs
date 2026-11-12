import type { IngestionDatabase } from './ingestion-port';
import type {
  AlertRequest,
  AlertTarget,
  Subscription,
} from '../alerts/subscription';

interface Row {
  id: string;
  email: string;
  locale: Subscription['locale'];
  category: string | null;
  country_code: string;
  city_id: string;
  status: Subscription['status'];
  created_at: string;
  confirmation_sent_at: string | null;
  confirmed_at: string | null;
  last_digest_at: string | null;
}
const columns = `id, email, locale, category, country_code, city_id, status, created_at,
  confirmation_sent_at, confirmed_at, last_digest_at`;

function toSubscription(row: Row): Subscription {
  return {
    id: row.id,
    email: row.email,
    locale: row.locale,
    category: row.category,
    countryCode: row.country_code,
    cityId: row.city_id,
    status: row.status,
    createdAt: row.created_at,
    confirmationSentAt: row.confirmation_sent_at,
    confirmedAt: row.confirmed_at,
    lastDigestAt: row.last_digest_at,
  };
}

/** The single subscription for an address and target, matching the unique index. */
export async function findSubscription(
  db: IngestionDatabase,
  email: string,
  target: AlertTarget,
): Promise<Subscription | null> {
  const result = await db
    .prepare(
      `SELECT ${columns} FROM alert_subscriptions
    WHERE email=? AND ifnull(category,'')=? AND city_id=? LIMIT 1`,
    )
    .bind(email, target.category ?? '', target.cityId)
    .all<Row>();
  const row = result.results[0];
  return row ? toSubscription(row) : null;
}

export async function getSubscription(
  db: IngestionDatabase,
  id: string,
): Promise<Subscription | null> {
  const result = await db
    .prepare(`SELECT ${columns} FROM alert_subscriptions WHERE id=? LIMIT 1`)
    .bind(id)
    .all<Row>();
  const row = result.results[0];
  return row ? toSubscription(row) : null;
}

/** Inserts a pending subscription; a concurrent duplicate is ignored. */
export async function insertPendingSubscription(
  db: IngestionDatabase,
  id: string,
  request: AlertRequest,
  now: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO alert_subscriptions(id, email, locale, category, country_code, city_id, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?) ON CONFLICT DO NOTHING`,
    )
    .bind(
      id,
      request.email,
      request.locale,
      request.category,
      request.countryCode,
      request.cityId,
      now,
    )
    .run();
}

export async function countConfirmationsSince(
  db: IngestionDatabase,
  email: string,
  since: string,
): Promise<number> {
  const result = await db
    .prepare(
      `SELECT count(*) AS n FROM alert_subscriptions
    WHERE email=? AND confirmation_sent_at > ?`,
    )
    .bind(email, since)
    .all<{ n: number }>();
  return result.results[0]?.n ?? 0;
}

export async function markConfirmationSent(
  db: IngestionDatabase,
  id: string,
  now: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE alert_subscriptions SET confirmation_sent_at=? WHERE id=? AND status='pending'`,
    )
    .bind(now, id)
    .run();
}

/** Idempotent: confirming twice keeps the first confirmation time. */
export async function confirmSubscription(
  db: IngestionDatabase,
  id: string,
  now: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE alert_subscriptions SET status='confirmed',
      confirmed_at=coalesce(confirmed_at, ?), last_digest_at=coalesce(last_digest_at, ?)
    WHERE id=?`,
    )
    .bind(now, now, id)
    .run();
}

export async function deleteSubscription(
  db: IngestionDatabase,
  id: string,
): Promise<void> {
  await db.prepare('DELETE FROM alert_subscriptions WHERE id=?').bind(id).run();
}

/** Confirmed subscriptions whose previous digest is at or before `cutoff`, oldest first. */
export async function listDueSubscriptions(
  db: IngestionDatabase,
  cutoff: string,
  limit: number,
): Promise<Subscription[]> {
  const result = await db
    .prepare(
      `SELECT ${columns} FROM alert_subscriptions
    WHERE status='confirmed' AND last_digest_at <= ?
    ORDER BY last_digest_at, id LIMIT ?`,
    )
    .bind(cutoff, limit)
    .all<Row>();
  return result.results.map(toSubscription);
}

/** Records digests in one batch; rows deleted meanwhile are simply not updated. */
export async function markDigestsSent(
  db: IngestionDatabase,
  ids: readonly string[],
  at: string,
): Promise<void> {
  if (ids.length === 0) return;
  await db.batch(
    ids.map((id) =>
      db
        .prepare(
          `UPDATE alert_subscriptions SET last_digest_at=? WHERE id=? AND status='confirmed'`,
        )
        .bind(at, id),
    ),
  );
}

export async function purgePendingSubscriptions(
  db: IngestionDatabase,
  createdBefore: string,
): Promise<void> {
  await db
    .prepare(
      `DELETE FROM alert_subscriptions WHERE status='pending' AND created_at < ?`,
    )
    .bind(createdBefore)
    .run();
}
