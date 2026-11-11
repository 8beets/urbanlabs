import type { Locale } from '../../i18n/ui';
import { listCategories } from '../db/courses';
import { liveCutoffDate } from '../db/clock';
import { loadGeography, type City } from '../locations/geography';
import { verifyTurnstile } from './adapters/turnstile';
import { describeTarget } from './emails';
import { createEmailSender, type EmailConfig } from './sender';
import {
  confirm,
  requestSubscription,
  subscriptionForToken,
  unsubscribe,
  type AlertContext,
} from './service';
import { InvalidAlertRequest, parseAlertRequest } from './subscription';

export interface AlertEnv extends EmailConfig {
  DB: D1Database;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  ALERT_TOKEN_SECRET?: string;
}

/** Alerts stay hidden until every piece of configuration exists. */
export function alertsConfigured(env: AlertEnv): boolean {
  if (
    !env.TURNSTILE_SITE_KEY ||
    !env.TURNSTILE_SECRET_KEY ||
    !env.ALERT_TOKEN_SECRET
  )
    return false;
  try {
    createEmailSender(env);
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether static pages may link to alerts, decided at build time from public
 * configuration only (Turnstile site key and sender settings). Secrets are not
 * available to the build; the alert pages still verify the full configuration per
 * request with `alertsConfigured` and answer 503 while anything is missing.
 */
export function alertsAdvertised(
  vars: EmailConfig & { TURNSTILE_SITE_KEY?: string },
): boolean {
  if (!vars.TURNSTILE_SITE_KEY) return false;
  if (vars.EMAIL_PROVIDER === 'log') return true;
  return vars.EMAIL_PROVIDER === 'brevo' && Boolean(vars.EMAIL_FROM);
}

function context(env: AlertEnv, origin: string, cities: City[]): AlertContext {
  return {
    db: env.DB,
    sender: createEmailSender(env),
    secret: env.ALERT_TOKEN_SECRET ?? '',
    siteUrl: origin,
    cities,
  };
}

export interface SignupPageData {
  status: number;
  state: 'form' | 'sent' | 'unavailable';
  error?: 'email' | 'target' | 'verification';
  siteKey: string;
  categories: string[];
  cities: City[];
  values: { email: string; category: string; city: string };
}

/** GET shows the form (prefilled from search filters); POST subscribes. */
export async function loadSignupPage(
  env: AlertEnv,
  request: Request,
  url: URL,
  locale: Locale,
): Promise<SignupPageData> {
  const isPost = request.method === 'POST';
  const form = isPost ? await request.formData().catch(() => null) : null;
  const source = form ?? url.searchParams;
  const field = (name: string) => {
    const value = source.get(name);
    return typeof value === 'string' ? value.trim().slice(0, 254) : '';
  };
  const base: SignupPageData = {
    status: 200,
    state: 'form',
    siteKey: env.TURNSTILE_SITE_KEY ?? '',
    categories: [],
    cities: [],
    values: {
      email: isPost ? field('email') : '',
      category: field('category'),
      city: field('city'),
    },
  };
  if (!alertsConfigured(env))
    return { ...base, status: 503, state: 'unavailable' };
  try {
    const [geography, today] = await Promise.all([
      loadGeography(env.DB),
      liveCutoffDate(env.DB),
    ]);
    const categories = await listCategories(env.DB, today);
    const data = { ...base, categories, cities: geography.cities };
    if (!isPost) return data;
    if (form === null) return { ...data, status: 400, error: 'email' };
    let parsed;
    try {
      parsed = parseAlertRequest(form, locale);
    } catch (error) {
      if (!(error instanceof InvalidAlertRequest)) throw error;
      return {
        ...data,
        status: 400,
        error: error.message === 'email' ? 'email' : 'target',
      };
    }
    const city = geography.cities.find((row) => row.id === parsed.cityId);
    if (
      (parsed.category !== null && !categories.includes(parsed.category)) ||
      (parsed.cityId !== null && !city)
    )
      return { ...data, status: 400, error: 'target' };
    const alert = { ...parsed, countryCode: city?.country_code ?? null };
    const verified = await verifyTurnstile(
      env.TURNSTILE_SECRET_KEY!,
      field('cf-turnstile-response'),
      request.headers.get('CF-Connecting-IP'),
    );
    if (!verified) return { ...data, status: 400, error: 'verification' };
    await requestSubscription(
      context(env, url.origin, geography.cities),
      alert,
    );
    return {
      ...data,
      state: 'sent',
      values: { email: '', category: '', city: '' },
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'alert_signup_failed',
        error: error instanceof Error ? error.message : 'unknown',
      }),
    );
    return { ...base, status: 503, state: 'unavailable' };
  }
}

export interface TokenPageData {
  status: number;
  state: 'ask' | 'done' | 'invalid' | 'unavailable';
  token: string;
  target: string;
}

/**
 * Confirm and unsubscribe links. GET only asks (mail scanners prefetch links); POST
 * acts. Unsubscribe also accepts RFC 8058 one-click POSTs that carry the token in the URL.
 */
export async function loadTokenPage(
  env: AlertEnv,
  request: Request,
  url: URL,
  locale: Locale,
  purpose: 'confirm' | 'unsubscribe',
): Promise<TokenPageData> {
  const isPost = request.method === 'POST';
  const form = isPost ? await request.formData().catch(() => null) : null;
  const posted = form?.get('token');
  const token = (
    typeof posted === 'string' ? posted : (url.searchParams.get('token') ?? '')
  ).slice(0, 200);
  const empty = { token, target: '' };
  if (!env.ALERT_TOKEN_SECRET)
    return { ...empty, status: 503, state: 'unavailable' };
  try {
    const geography = await loadGeography(env.DB);
    const ctx = {
      db: env.DB,
      secret: env.ALERT_TOKEN_SECRET,
    };
    const subscription = isPost
      ? purpose === 'confirm'
        ? await confirm(ctx, token)
        : await unsubscribe(ctx, token)
      : await subscriptionForToken(ctx, purpose, token);
    if (!subscription) return { ...empty, status: 404, state: 'invalid' };
    return {
      token,
      target: describeTarget(subscription, locale, geography.cities),
      status: 200,
      state: isPost ? 'done' : 'ask',
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'alert_link_failed',
        purpose,
        error: error instanceof Error ? error.message : 'unknown',
      }),
    );
    return { ...empty, status: 503, state: 'unavailable' };
  }
}
