import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteContract } from '../helpers/sqlite-contract';
import { getSource } from '../../src/lib/sources';
import { runIngestion } from '../../src/lib/ingestion/run';
import { parseMiramPage } from '../../src/lib/ingestion/adapters/miram';
import {
  confirm,
  purgeUnconfirmed,
  requestSubscription,
  sendDueDigests,
  subscriptionForToken,
  unsubscribe,
  type AlertContext,
} from '../../src/lib/alerts/service';
import {
  EmailSendError,
  type EmailMessage,
} from '../../src/lib/alerts/email-sender';
import type { AlertRequest } from '../../src/lib/alerts/subscription';

const santAndreu = getSource('miram-sant-andreu');
const migrationDirectory = new URL('../../migrations/', import.meta.url);
const migration = readdirSync(migrationDirectory)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => readFileSync(new URL(name, migrationDirectory), 'utf8'))
  .join('\n');
const records = parseMiramPage(
  readFileSync(
    new URL('../fixtures/miram-sant-andreu-languages.html', import.meta.url),
    'utf8',
  ),
  `${santAndreu.listingUrl}&f=ID`,
).records.map((record) => ({
  ...record,
  startDate: '2099-01-10',
  endDate: '2099-06-30',
}));

const SITE = 'https://urbanlabs.example';
const request = (overrides: Partial<AlertRequest> = {}): AlertRequest => ({
  email: 'ana@example.org',
  locale: 'es',
  category: 'idiomes',
  countryCode: 'ES',
  cityId: 'barcelona',
  ...overrides,
});
const tokenFrom = (message: EmailMessage) =>
  decodeURIComponent(/token=([^\s"&]+)/.exec(message.text)![1]!);

describe('course alerts against the SQLite contract', () => {
  let sqlite: DatabaseSync;
  let sent: EmailMessage[];
  let now: Date;
  let context: AlertContext;
  const count = (sql: string) => (sqlite.prepare(sql).get() as { n: number }).n;

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec(migration);
    sent = [];
    now = new Date('2020-01-01T09:00:00.000Z');
    context = {
      db: sqliteContract(sqlite),
      sender: { send: async (message) => void sent.push(message) },
      secret: 'integration-test-secret-long-enough-0000',
      siteUrl: SITE,
      cities: [{ id: 'barcelona', name: 'Barcelona' }],
      now: () => now,
    };
  });
  afterEach(() => {
    sqlite.close();
    vi.restoreAllMocks();
  });

  it('enforces one target per row and one row per address and target', () => {
    const insert = (id: string, category: string | null, city: string | null) =>
      sqlite
        .prepare(
          `INSERT INTO alert_subscriptions(id,email,locale,category,country_code,city_id,status,created_at)
          VALUES (?, 'a@b.cd', 'es', ?, ?, ?, 'pending', '2020-01-01')`,
        )
        .run(id, category, city ? 'ES' : null, city);
    expect(() => insert('1', null, null)).toThrow(/CHECK/);
    expect(() => insert('2', 'CUINA', 'nowhere')).toThrow(/FOREIGN KEY/);
    insert('3', null, 'barcelona');
    expect(() => insert('4', null, 'barcelona')).toThrow(/UNIQUE/);
    insert('5', 'CUINA', 'barcelona');
    expect(() =>
      sqlite.exec(
        "UPDATE alert_subscriptions SET status='confirmed' WHERE id='5'",
      ),
    ).toThrow(/CHECK/);
  });

  it('double opt-in: confirms only on an explicit action, without resending spam', async () => {
    expect(await requestSubscription(context, request())).toBe('sent');
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe('ana@example.org');
    expect(sent[0]!.text).toContain(`${SITE}/es/alertas/confirmar?token=`);
    // Repeating the request the same day sends nothing and reveals nothing.
    expect(await requestSubscription(context, request())).toBe('skipped');
    expect(sent).toHaveLength(1);
    const token = tokenFrom(sent[0]!);
    // Looking at the link (what a mail scanner does) does not confirm.
    expect(
      (await subscriptionForToken(context, 'confirm', token))?.status,
    ).toBe('pending');
    expect(
      await subscriptionForToken(context, 'unsubscribe', token),
    ).toBeNull();
    expect((await confirm(context, token))?.id).toBeDefined();
    expect(await confirm(context, token)).not.toBeNull();
    expect(
      sqlite
        .prepare(
          'SELECT status, confirmed_at, last_digest_at FROM alert_subscriptions',
        )
        .get(),
    ).toEqual({
      status: 'confirmed',
      confirmed_at: now.toISOString(),
      last_digest_at: now.toISOString(),
    });
    expect(await requestSubscription(context, request())).toBe('skipped');
  });

  it('caps confirmation emails per address and allows a resend the next day', async () => {
    for (const category of ['idiomes', 'cuina', 'musica', 'dansa'])
      await requestSubscription(context, request({ category }));
    expect(sent).toHaveLength(3);
    now = new Date('2020-01-02T09:00:01.000Z');
    expect(await requestSubscription(context, request())).toBe('sent');
    expect(sent).toHaveLength(4);
  });

  it('keeps the pending row retryable when the confirmation email fails', async () => {
    context.sender = {
      send: async () => {
        throw new EmailSendError('Brevo HTTP 503', true);
      },
    };
    await expect(requestSubscription(context, request())).rejects.toThrow();
    expect(
      count(
        "SELECT count(*) AS n FROM alert_subscriptions WHERE confirmation_sent_at IS NULL AND status='pending'",
      ),
    ).toBe(1);
  });

  it('sends due digests idempotently, matching category and city', async () => {
    const subscribe = async (overrides: Partial<AlertRequest>) => {
      sent = [];
      await requestSubscription(context, request(overrides));
      await confirm(context, tokenFrom(sent[0]!));
    };
    await subscribe({});
    await subscribe({ email: 'bo@example.org', category: 'cuina' });
    await subscribe({
      email: 'cy@example.org',
      category: null,
      cityId: 'tarragona',
    });
    // Ingestion stamps first_seen_at with the real clock, after the 2020 confirmations.
    await runIngestion(
      context.db,
      { fetchRecords: async () => records },
      santAndreu,
    );
    sent = [];
    now = new Date(Date.now() + 60_000);
    const options = { today: '2026-11-10', emailLimit: 250 };
    expect(await sendDueDigests(context, options)).toEqual({
      due: 3,
      sent: 1,
      empty: 2,
      failed: 0,
      truncated: false,
    });
    expect(sent).toHaveLength(1);
    const digest = sent[0]!;
    expect(digest.to).toBe('ana@example.org');
    expect(digest.text).toContain(records[0]!.title);
    expect(digest.text).toContain(
      `${SITE}/es/buscar?category=idiomes&country=ES&city=barcelona`,
    );
    expect(
      count(
        `SELECT count(*) AS n FROM alert_subscriptions WHERE last_digest_at='${now.toISOString()}'`,
      ),
    ).toBe(3);
    // Same data, same week: nothing is due, nothing is sent again.
    expect((await sendDueDigests(context, options)).due).toBe(0);
    now = new Date(now.getTime() + 8 * 86_400_000);
    expect(await sendDueDigests(context, options)).toMatchObject({
      due: 3,
      sent: 0,
      empty: 3,
    });
    expect(sent).toHaveLength(1);

    // The unsubscribe link in the digest deletes the row.
    const token = tokenFrom({ ...digest, text: digest.text.split('--')[1]! });
    expect((await unsubscribe(context, token))?.email).toBe('ana@example.org');
    expect(await unsubscribe(context, token)).toBeNull();
    expect(
      count(
        "SELECT count(*) AS n FROM alert_subscriptions WHERE email='ana@example.org'",
      ),
    ).toBe(0);
  });

  it('does not advance a digest that failed to send, and respects the email limit', async () => {
    await requestSubscription(context, request());
    await confirm(context, tokenFrom(sent[0]!));
    await runIngestion(
      context.db,
      { fetchRecords: async () => records },
      santAndreu,
    );
    const confirmedAt = now.toISOString();
    now = new Date(Date.now() + 60_000);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    context.sender = {
      send: async () => {
        throw new EmailSendError('Brevo HTTP 503', true);
      },
    };
    const options = { today: '2026-11-10', emailLimit: 250 };
    expect(await sendDueDigests(context, options)).toMatchObject({
      sent: 0,
      failed: 1,
    });
    expect(
      count(
        `SELECT count(*) AS n FROM alert_subscriptions WHERE last_digest_at='${confirmedAt}'`,
      ),
    ).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.not.stringContaining('ana@example.org'),
    );
    sent = [];
    context.sender = { send: async (message) => void sent.push(message) };
    expect(
      await sendDueDigests(context, { ...options, emailLimit: 0 }),
    ).toMatchObject({ due: 1, sent: 0, empty: 0 });
    expect(
      await sendDueDigests(context, { ...options, dryRun: true }),
    ).toMatchObject({ sent: 1 });
    expect(sent).toHaveLength(0);
    expect((await sendDueDigests(context, options)).sent).toBe(1);
    expect(sent).toHaveLength(1);
  });

  it('purges unconfirmed sign-ups after seven days and keeps confirmed ones', async () => {
    await requestSubscription(context, request());
    await confirm(context, tokenFrom(sent[0]!));
    await requestSubscription(
      context,
      request({ email: 'pending@example.org' }),
    );
    now = new Date('2020-01-07T09:00:00.000Z');
    await purgeUnconfirmed(context);
    expect(count('SELECT count(*) AS n FROM alert_subscriptions')).toBe(2);
    now = new Date('2020-01-08T09:00:01.000Z');
    await purgeUnconfirmed(context);
    expect(
      sqlite.prepare('SELECT email, status FROM alert_subscriptions').all(),
    ).toEqual([{ email: 'ana@example.org', status: 'confirmed' }]);
  });
});
