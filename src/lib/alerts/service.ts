import type { IngestionDatabase } from '../db/ingestion-port';
import { listNewCourses } from '../db/courses';
import {
  confirmSubscription as markConfirmed,
  countConfirmationsSince,
  deleteSubscription,
  findSubscription,
  getSubscription,
  insertPendingSubscription,
  listDueSubscriptions,
  markConfirmationSent,
  markDigestsSent,
  purgePendingSubscriptions,
} from '../db/subscriptions';
import {
  confirmationEmail,
  describeTarget,
  digestEmail,
  searchUrl,
  type CityName,
} from './emails';
import { alertPath } from '../../i18n/paths';
import { EmailSendError, type EmailSender } from './email-sender';
import {
  CONFIRMATIONS_PER_EMAIL_PER_DAY,
  digestCutoff,
  matchDigest,
  mayResendConfirmation,
  pendingCutoff,
  resendCutoff,
  signToken,
  verifyToken,
  type AlertRequest,
  type Subscription,
  type TokenPurpose,
} from './subscription';

/** Everything the use cases need; the Worker and the CLI job build it differently. */
export interface AlertContext {
  db: IngestionDatabase;
  sender: EmailSender;
  /** HMAC key for confirm/unsubscribe links, at least 32 characters. */
  secret: string;
  /** Public origin used in email links, without a trailing slash. */
  siteUrl: string;
  cities: readonly CityName[];
  now?: () => Date;
}

const clock = (context: Pick<AlertContext, 'now'>) =>
  (context.now ?? (() => new Date()))();

async function linkFor(
  context: AlertContext,
  subscription: Pick<Subscription, 'id' | 'locale'>,
  purpose: TokenPurpose,
): Promise<string> {
  const token = await signToken(context.secret, purpose, subscription.id);
  const page = purpose === 'confirm' ? 'confirm' : 'unsubscribe';
  return `${context.siteUrl}${alertPath(subscription.locale, page)}?token=${encodeURIComponent(token)}`;
}

/**
 * Creates (or reuses) a pending subscription and sends the confirmation email. The
 * caller shows the same message whatever happens here, so nobody can learn whether an
 * address is subscribed. Category and city must already be validated against data.
 */
export async function requestSubscription(
  context: AlertContext,
  request: AlertRequest,
): Promise<'sent' | 'skipped'> {
  const now = clock(context);
  let subscription = await findSubscription(context.db, request.email, request);
  if (subscription && !mayResendConfirmation(subscription, now))
    return 'skipped';
  // Bounds what anyone can make us send to a third party's address.
  if (
    (await countConfirmationsSince(
      context.db,
      request.email,
      resendCutoff(now),
    )) >= CONFIRMATIONS_PER_EMAIL_PER_DAY
  )
    return 'skipped';
  if (!subscription) {
    await insertPendingSubscription(
      context.db,
      crypto.randomUUID(),
      request,
      now.toISOString(),
    );
    subscription = await findSubscription(context.db, request.email, request);
    if (!subscription) throw new Error('Pending subscription was not stored');
  }
  await context.sender.send(
    confirmationEmail({
      to: subscription.email,
      locale: subscription.locale,
      target: describeTarget(subscription, subscription.locale, context.cities),
      confirmUrl: await linkFor(context, subscription, 'confirm'),
    }),
  );
  await markConfirmationSent(context.db, subscription.id, now.toISOString());
  return 'sent';
}

/** Looks up the subscription a link points to, without changing anything. */
export async function subscriptionForToken(
  context: Pick<AlertContext, 'db' | 'secret'>,
  purpose: TokenPurpose,
  token: string,
): Promise<Subscription | null> {
  const id = await verifyToken(context.secret, purpose, token);
  return id === null ? null : getSubscription(context.db, id);
}

export async function confirm(
  context: Pick<AlertContext, 'db' | 'secret' | 'now'>,
  token: string,
): Promise<Subscription | null> {
  const subscription = await subscriptionForToken(context, 'confirm', token);
  if (!subscription) return null;
  await markConfirmed(
    context.db,
    subscription.id,
    clock(context).toISOString(),
  );
  return subscription;
}

/** Deletes the subscription (data minimisation), not just a flag. */
export async function unsubscribe(
  context: Pick<AlertContext, 'db' | 'secret'>,
  token: string,
): Promise<Subscription | null> {
  const subscription = await subscriptionForToken(
    context,
    'unsubscribe',
    token,
  );
  if (subscription) await deleteSubscription(context.db, subscription.id);
  return subscription;
}

export interface DigestRunOptions {
  /** Live-edition cutoff date (YYYY-MM-DD), as used by public pages. */
  today: string;
  /** Maximum emails this run may send (provider daily quota minus headroom). */
  emailLimit: number;
  /** Due subscriptions read per run; the rest stay due for the next run. */
  scanLimit?: number;
  dryRun?: boolean;
}
export interface DigestRunResult {
  due: number;
  sent: number;
  empty: number;
  failed: number;
  truncated: boolean;
}
const FLUSH_EVERY = 20;
const MAX_CONSECUTIVE_FAILURES = 5;

/**
 * Sends weekly digests to due subscriptions. last_digest_at advances only after a
 * successful send (or when there was nothing to send), so a failed run is retried by
 * the next one. Updates are flushed in small batches to bound duplicate sends if the
 * job dies mid-run.
 */
export async function sendDueDigests(
  context: AlertContext,
  options: DigestRunOptions,
): Promise<DigestRunResult> {
  const now = clock(context);
  const runAt = now.toISOString();
  const due = await listDueSubscriptions(
    context.db,
    digestCutoff(now),
    options.scanLimit ?? 1000,
  );
  const result: DigestRunResult = {
    due: due.length,
    sent: 0,
    empty: 0,
    failed: 0,
    truncated: false,
  };
  if (due.length === 0) return result;
  const since = due.reduce(
    (oldest, row) =>
      row.lastDigestAt !== null && row.lastDigestAt < oldest
        ? row.lastDigestAt
        : oldest,
    runAt,
  );
  const listing = await listNewCourses(context.db, since, options.today);
  result.truncated = listing.truncated;
  // Courses first seen after runAt belong to the next digest, which starts at runAt.
  const courses = listing.courses.filter(
    (course) => course.firstSeenAt <= runAt,
  );
  let done: string[] = [];
  const flush = async () => {
    if (!options.dryRun) await markDigestsSent(context.db, done, runAt);
    done = [];
  };
  let consecutiveFailures = 0;
  for (const subscription of due) {
    if (result.sent >= options.emailLimit) break;
    const matches = matchDigest(subscription, courses);
    if (matches.length === 0) {
      result.empty++;
      done.push(subscription.id);
    } else {
      const message = digestEmail({
        to: subscription.email,
        locale: subscription.locale,
        target: describeTarget(
          subscription,
          subscription.locale,
          context.cities,
        ),
        courses: matches,
        searchUrl: searchUrl(
          context.siteUrl,
          subscription,
          subscription.locale,
        ),
        unsubscribeUrl: await linkFor(context, subscription, 'unsubscribe'),
      });
      try {
        if (!options.dryRun) await context.sender.send(message);
        result.sent++;
        consecutiveFailures = 0;
        done.push(subscription.id);
      } catch (error) {
        result.failed++;
        consecutiveFailures++;
        // No address or content in logs: the subscription id is enough to investigate.
        console.error(
          JSON.stringify({
            event: 'alert_digest_failed',
            subscription: subscription.id,
            error: error instanceof Error ? error.message : 'unknown',
            retryable: error instanceof EmailSendError ? error.retryable : null,
          }),
        );
        // A provider outage or a revoked key would otherwise fail every remaining send.
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) break;
      }
    }
    if (done.length >= FLUSH_EVERY) await flush();
  }
  await flush();
  return result;
}

export async function purgeUnconfirmed(
  context: Pick<AlertContext, 'db' | 'now'>,
): Promise<void> {
  await purgePendingSubscriptions(context.db, pendingCutoff(clock(context)));
}
