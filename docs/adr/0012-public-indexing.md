# ADR 0012: Open the site to search engines

Status: accepted

## Context

The public preview carried `<meta name="robots" content="noindex,follow">` on every page
until canonical URLs, a sitemap and the handling of ended courses were in place. Pages
are prerendered (ADR 0008), filters live in the query string, topic and centre pages
are paginated with numbered paths, and slugs are translated between Spanish and
Catalan (`/es/proyecto` ↔ `/ca/projecte`). The site is served at
`https://urbanlabs.fyi` and also at the Worker's `workers.dev` address.

## Decision

- Pages are indexable by default. Pages that must stay out of results opt out with
  `indexable={false}` in the layout and keep `noindex,follow`: alert sign-up and token
  pages, and the 404. They are not blocked in robots.txt, so crawlers can read the
  `noindex`.
- `site` is `https://urbanlabs.fyi`. Every indexable page has a canonical link to its
  own path in its language, without the query string, so filtered views share the
  canonical of the unfiltered page; numbered pages keep their own. This also makes
  `urbanlabs.fyi` canonical over the `workers.dev` address.
- `hreflang` alternates come from the localized paths each page already passes to the
  layout (`es`, `ca` and `x-default` → Spanish), so translated slugs pair correctly.
  The sitemap's own i18n option is not used because it pairs pages by swapping the
  locale prefix.
- `@astrojs/sitemap` lists the prerendered pages except alerts, search JSON and the 404.
  `public/robots.txt` allows everything but the JSON search data and the alert API, and
  names the sitemap.
- Titles and meta descriptions are unique per page type and city: numbered pages add
  their page number, topic pages name the topic and city, centre pages name the centre.
- Structured data uses only facts a page shows: `WebSite` on the home page and a
  schema.org `Place` (address, map point, phone, email, official site) on centre pages.
  Courses are not marked up yet: the data has no descriptions or confirmed
  availability, and course markup is better added with course detail pages.
- Ended courses are already omitted from prerendered listings, which are rebuilt daily.

## Consequences

- Search engines can index the directory from the next deploy; the Spanish home page is
  the default for other languages.
- Adding a page type means choosing its title, description and whether it is indexable.
- Course detail pages, with their own canonical URLs and `Course` markup, remain a
  separate step.
