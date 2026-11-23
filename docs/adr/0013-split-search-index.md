# ADR 0013: Split the search index into filter data and card details

Status: accepted

## Context

The browser search downloads its city's live index for every search (ADR 0008,
ADR 0010), and CI fails a deploy when that file exceeds 150 KB gzipped. On 2026-11-23
Barcelona's reached 179 KB (scheduled deploy #45) after more civic centres were
added. Splitting by city had already been done; Barcelona alone was now too large.

Filtering and sorting need only a few fields of each edition: title, raw category,
centre, dates, price and the cancelled and sold-out flags. The rest (schedule, source
link, organiser, currency, reviewed-title flag, verification date) is only shown on
the 30 cards of the current page, yet it was downloaded for every edition. The source
links alone are long (Miram links repeat the host, path and query of the listing).

## Decision

- `/search/<city>/live.json` and `archive.json` keep only the fields needed for
  filtering and sorting (index version 5). They also carry only the city's own
  locations and geography, not every city's.
- The card details go to `/search/<city>/details/<n>.json`, 100 editions per file
  (`DETAIL_CHUNK_SIZE`). The search script filters with the index, then loads the
  detail files of the editions on the page and joins them (`withDetails`) before
  rendering.
- Editions are numbered in listing order: live editions in the default order
  (`compareLive`), then ended ones in archive order. The first pages of an unfiltered
  search therefore need only `details/0.json`, which the script fetches alongside the
  index. A filtered page needs the files its editions fall in (usually a few). The
  numbering keeps the tie-breaks of the former id order.
- The filter form is filled in and enhanced as soon as the index is filtered, before
  the details arrive, so it does not reset a choice made in the meantime.
- Every file carries the build's `generatedAt`. Positions only mean something within
  one build, so if files of two builds meet (a deploy between two requests), the script
  fetches them all again once, bypassing the browser cache. Missing details show the
  existing "search unavailable" message rather than cards without links.
- `check:build` keeps the 150 KB budget for each live index and adds a 20 KB gzipped
  budget per detail file.

## Consequences

- The first download shrinks by the share of the card details: about 40% on a
  synthetic Barcelona-sized catalogue (44.6 KB to 25.9 KB gzipped; real titles compress
  less, so the real saving is smaller). It grows with the number of editions more
  slowly than before.
- A filtered search makes one to a few extra small requests (about 1–5 KB each); they
  are cached and revalidated like the index (`/search/*` in `public/_headers`).
- Each build writes about one detail file per 100 editions per city, well within the
  Workers Free limit of 20,000 static files.
- If a live index exceeds the budget again, the next step is to drop more from it
  (for example, encode titles more compactly) or to split a city's index further,
  before raising the budget.
