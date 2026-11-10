# ADR 0007: Weekly email alerts through a swappable sender

Status: accepted

## Context

Issue #80 asks for email alerts when new courses appear for a category and/or city.
UrbanLabs had no outgoing email, no stored personal data and no public POST form.
Cloudflare Email Service is the natural fit, but on 2026-11-10 its
[pricing page](https://developers.cloudflare.com/email-service/platform/pricing/)
said sending to arbitrary recipients needs Workers Paid ($5/month minimum, 3,000
emails included, then $0.35 per 1,000). That conflicts with the Free-plan rule in
`AGENTS.md`. Brevo's free tier allows 300 emails/day without a contract. Its Starter
plan is about $9/month for 5,000 emails, according to third-party reviews; Brevo's
own pricing page was not machine-readable when checked.

## Decision

- **Brevo free tier now, behind a port.** `src/lib/alerts/email-sender.ts` defines
  `EmailSender`; `adapters/brevo.ts` implements it; `sender.ts` is the only code that
  picks a provider, from `EMAIL_PROVIDER`. Domain rules (`subscription.ts`), email
  rendering (`emails.ts`) and use cases (`service.ts`) know nothing about Brevo or
  Cloudflare. Moving to Cloudflare Email Service means adding `adapters/cloudflare.ts`
  (a `send_email` binding or REST call), one `case` in `sender.ts`, and the paid-plan
  exception in `AGENTS.md`.
- **Weekly digest, sent daily in slices.** A GitHub Actions job (`alerts.yml`, the same
  Wrangler-to-D1 bridge as ingestion) sends to confirmed subscriptions whose last
  digest is at least 7 days old, capped at 250 emails per run. The weekly load spreads
  across days, so the Brevo daily quota is never hit in a burst. One bounded query
  lists courses first seen since the oldest due digest; matching happens in memory.
- **Double opt-in with Turnstile.** The form needs a Turnstile token checked server
  side. A confirmation email is sent at most once per subscription per 24 hours, and
  to at most 3 targets per address per day. The page always answers the same way,
  so it never reveals whether an address is subscribed.
- **Signed links, no stored tokens.** Confirm and unsubscribe links carry
  `id.HMAC-SHA256(ALERT_TOKEN_SECRET, purpose:id)`. A confirm link cannot unsubscribe,
  and links stay valid until the row is deleted. GET pages only ask; a POST acts,
  because mail scanners prefetch links.
- **Data minimisation.** Only email, locale, target and timestamps are stored.
  Unsubscribing deletes the row. Unconfirmed rows are purged after 7 days. Logs carry
  subscription ids, never addresses.

## Consequences

- Production needs a sending domain with SPF/DKIM/DMARC, a Brevo API key, a Turnstile
  widget and a token secret before alerts appear (`docs/deployment.md`). Until then
  the search link is hidden and the alert pages answer 503.
- Brevo adds its own `List-Unsubscribe` header to transactional mail, and its API does
  not document overriding standard headers. Mail-client unsubscribes are therefore
  handled by Brevo's blocklist, while the body link deletes our row. A Cloudflare
  adapter can set RFC 8058 headers from `EmailMessage.unsubscribeUrl`; the unsubscribe
  route already accepts one-click POSTs.
- Above roughly 9,000 emails/month (300/day) the free tier is not enough. At that
  point, compare Brevo Starter with Workers Paid and swap the adapter if cheaper.
- A digest lists at most 20 courses and links to the full search. A week with more
  than 2,000 new editions truncates the scan; this is logged.
