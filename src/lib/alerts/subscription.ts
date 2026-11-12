import type { Locale } from '../../paraglide/runtime.js';
import { courseTopic, isTopic } from '../courses/categories';

/** What a visitor asks to be alerted about. At least one of category or city is set. */
export interface AlertTarget {
  category: string | null;
  countryCode: string | null;
  cityId: string | null;
}
export interface AlertRequest extends AlertTarget {
  email: string;
  locale: Locale;
}
export interface Subscription extends AlertTarget {
  id: string;
  email: string;
  locale: Locale;
  status: 'pending' | 'confirmed';
  createdAt: string;
  confirmationSentAt: string | null;
  confirmedAt: string | null;
  lastDigestAt: string | null;
}
/** A course as the digest needs it; built by the course repository. */
export interface NewCourse {
  id: string;
  title: string;
  category: string | null;
  cityId: string | null;
  institution: string;
  startDate: string | null;
  scheduleText: string | null;
  officialUrl: string;
  firstSeenAt: string;
}

export const DIGEST_INTERVAL_DAYS = 7;
export const DIGEST_COURSE_LIMIT = 20;
export const PENDING_RETENTION_DAYS = 7;
export const CONFIRMATION_RESEND_HOURS = 24;
/** Confirmation emails one address may receive per day, across all of its targets. */
export const CONFIRMATIONS_PER_EMAIL_PER_DAY = 3;

export class InvalidAlertRequest extends Error {}

// Deliberately loose: the confirmation email is the real validation.
const EMAIL = /^[^\s@<>()",;:\\]+@[^\s@<>()",;:\\]+\.[^\s@<>()",;:\\]+$/;
const IDENTIFIER = /^[a-z0-9-]{1,100}$/;

/** Validates untrusted form input. Category and city existence are checked by the caller. */
export function parseAlertRequest(
  form: { get(name: string): unknown },
  locale: Locale,
): AlertRequest {
  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === 'string' ? value.trim() : '';
  };
  const email = text('email').toLowerCase();
  if (email.length > 254 || !EMAIL.test(email))
    throw new InvalidAlertRequest('email');
  const category = text('category');
  if (category && !isTopic(category)) throw new InvalidAlertRequest('category');
  const cityId = text('city');
  if (cityId && !IDENTIFIER.test(cityId)) throw new InvalidAlertRequest('city');
  if (!category && !cityId) throw new InvalidAlertRequest('target');
  return {
    email,
    locale,
    category: category || null,
    // The caller sets the country from the city catalog after checking the city exists.
    countryCode: null,
    cityId: cityId || null,
  };
}

function hoursAgo(now: Date, hours: number): string {
  return new Date(now.getTime() - hours * 3600_000).toISOString();
}
export const digestCutoff = (now: Date) =>
  hoursAgo(now, DIGEST_INTERVAL_DAYS * 24);
export const pendingCutoff = (now: Date) =>
  hoursAgo(now, PENDING_RETENTION_DAYS * 24);
export const resendCutoff = (now: Date) =>
  hoursAgo(now, CONFIRMATION_RESEND_HOURS);

/** Whether a pending subscription may receive another confirmation email now. */
export function mayResendConfirmation(
  subscription: Pick<Subscription, 'status' | 'confirmationSentAt'>,
  now: Date,
): boolean {
  return (
    subscription.status === 'pending' &&
    (subscription.confirmationSentAt === null ||
      subscription.confirmationSentAt <= resendCutoff(now))
  );
}

/**
 * Courses for one digest: first seen after the previous digest and matching every
 * set part of the target. `courses` must come newest first.
 */
export function matchDigest(
  subscription: AlertTarget & Pick<Subscription, 'lastDigestAt'>,
  courses: readonly NewCourse[],
): NewCourse[] {
  const since = subscription.lastDigestAt ?? '';
  return courses
    .filter(
      (course) =>
        course.firstSeenAt > since &&
        (subscription.category === null ||
          courseTopic(course) === subscription.category) &&
        (subscription.cityId === null || course.cityId === subscription.cityId),
    )
    .slice(0, DIGEST_COURSE_LIMIT);
}

// Tokens are HMAC-SHA256(secret, purpose:id): nothing secret is stored, links stay valid
// until the row is deleted, and a confirm link cannot be replayed as an unsubscribe link.
export type TokenPurpose = 'confirm' | 'unsubscribe';

async function hmacKey(secret: string, usage: KeyUsage) {
  if (secret.length < 32) throw new Error('Alert token secret is too short');
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage],
  );
}
function toBase64Url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}
function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return null;
  const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function signToken(
  secret: string,
  purpose: TokenPurpose,
  id: string,
): Promise<string> {
  const signature = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret, 'sign'),
    new TextEncoder().encode(`${purpose}:${id}`),
  );
  return `${id}.${toBase64Url(signature)}`;
}

/** Returns the subscription id when the token is authentic, otherwise null. */
export async function verifyToken(
  secret: string,
  purpose: TokenPurpose,
  token: string,
): Promise<string | null> {
  const [id, encoded, extra] = token.split('.');
  if (extra !== undefined || !id || !UUID.test(id) || !encoded) return null;
  const signature = fromBase64Url(encoded);
  if (signature === null) return null;
  // subtle.verify compares in constant time.
  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret, 'verify'),
    signature,
    new TextEncoder().encode(`${purpose}:${id}`),
  );
  return valid ? id : null;
}
