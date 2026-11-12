import { parseArgs } from 'node:util';
import { WranglerIngestionDatabase } from '../src/lib/db/wrangler-ingestion';
import { liveCutoffDate } from '../src/lib/db/clock';
import { createEmailSender } from '../src/lib/alerts/sender';
import { createLogSender } from '../src/lib/alerts/adapters/log';
import { purgeUnconfirmed, sendDueDigests } from '../src/lib/alerts/service';

// Daily job: purge unconfirmed sign-ups, then send the weekly digests that are due.
// `--dry-run` reads production D1 and reports counts without sending or writing.
// Strict parsing: a mistyped `--dry-run` must fail, not send real emails.
const { values } = parseArgs({
  options: { 'dry-run': { type: 'boolean' }, limit: { type: 'string' } },
});
const dryRun = values['dry-run'] ?? false;
const emailLimit = Number(values.limit ?? process.env.ALERT_DAILY_LIMIT ?? 250);
if (!Number.isInteger(emailLimit) || emailLimit < 0)
  throw new Error('--limit must be a non-negative integer');
const siteUrl = (process.env.SITE_URL ?? '').replace(/\/$/, '');
if (!/^https:\/\/[^/]+$/.test(siteUrl))
  throw new Error('SITE_URL must be an https origin');
const secret = process.env.ALERT_TOKEN_SECRET ?? '';

const db = new WranglerIngestionDatabase();
const cities = (
  await db
    .prepare('SELECT id, name FROM cities ORDER BY id LIMIT 1000')
    .all<{ id: string; name: string }>()
).results;
const context = {
  db,
  sender: dryRun ? createLogSender() : createEmailSender(process.env),
  secret,
  siteUrl,
  cities,
};
if (!dryRun) await purgeUnconfirmed(context);
const result = await sendDueDigests(context, {
  today: await liveCutoffDate(db),
  emailLimit,
  dryRun,
});
console.info(JSON.stringify({ event: 'alert_digests', dryRun, ...result }));
// shortcut: one bounded course scan per run (2000 editions); page it if a week ever exceeds that.
if (result.truncated)
  console.warn(JSON.stringify({ event: 'alert_new_courses_truncated' }));
if (result.failed > 0) process.exitCode = 1;
