import { Command } from 'commander';
import { integer } from './options';

// Daily job. Commander rejects unknown options, so a mistyped --dry-run fails
// instead of sending real emails.
export const alertsSendCommand = new Command('alerts-send')
  .description(
    'Purge unconfirmed sign-ups, then send the weekly digests that are due',
  )
  .option(
    '--dry-run',
    'read production D1 and report counts without sending or writing',
  )
  .option(
    '--limit <n>',
    'emails per run (default: ALERT_DAILY_LIMIT or 250)',
    integer,
  )
  .action(async (options: { dryRun?: boolean; limit?: number }) => {
    // Loaded here: the alert emails need the compiled Paraglide messages, which the
    // other commands' workflows (ingestion, snapshot, freshness) do not build.
    const [
      { WranglerIngestionDatabase },
      { liveCutoffDate },
      { createEmailSender },
      { createLogSender },
      { purgeUnconfirmed, sendDueDigests },
    ] = await Promise.all([
      import('../lib/db/wrangler-ingestion'),
      import('../lib/db/clock'),
      import('../lib/alerts/sender'),
      import('../lib/alerts/adapters/log'),
      import('../lib/alerts/service'),
    ]);
    const dryRun = options.dryRun ?? false;
    const emailLimit =
      options.limit ?? integer(process.env.ALERT_DAILY_LIMIT ?? '250');
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
  });
