# Data source research

Research dates: 2026-11-05–06. Live results can change.

## Approved local research source: Miram / Centre Cívic Sant Andreu

- Official institution: https://ajuntament.barcelona.cat/ccivics/santandreu
- Public registration listing: https://santandreu.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=22&t=AC
- Platform: Miram Modular, shared with other civic centres.
- Institution configuration: `src/lib/sources/sant-andreu.ts`.
- Access: public HTML; no authentication, browser automation, or access-control bypass.
- `https://santandreu.inscripcionscc.com/robots.txt` returned HTTP 404. The adapter rechecks this before every import; any newly present policy blocks ingestion pending review.
- The official institution website links directly to this registration host. The listing footer confirms the institution address.
- Live verification fetched the category index and six course categories, producing 22 distinct activity IDs with titles, dates, base prices, and schedule text. A four-record language-category excerpt is saved in `tests/fixtures/miram-sant-andreu-languages.html`.
- Category links are discovered, not hardcoded. The initial pagination selector missed plain numbered anchors; the corrected adapter supports those alongside `.pagination` and `rel=next`. The complete 2026-11-06 refresh returned 37 editions.
- No public structured API/feed was established for this host during research. HTML is the verified fallback; no private endpoints were probed.

No blanket redistribution license was established for registration-site content. This milestone limits extraction to course facts and attribution, excluding descriptions, images, instructor biographies, and contact details. Review reuse terms with the maintainer before public publication or expanding collection. An absent robots file does not establish a reuse license.

Availability and course language remain unknown. Prices refer to the explicitly labelled base price; concessions and materials supplements are not represented. Listings must not be advertised as confirmed available, free when unpriced, or translated. Some observed weekday summaries and individual session dates disagree. We preserve the summary verbatim and do not generate recurring sessions or resolve those contradictions by inference.

## Centre Cívic Can Basté

Verified on 2026-11-06:

- Official centre: https://www.canbaste.com/
- Registration: https://canbaste.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=30&t=AC
- Address: Pg. de Fabra i Puig, 274, 08031 Barcelona, confirmed on the official site.
- `robots.txt` returned 404; the existing adapter's per-run check applies.
- The shared Miram adapter fetched and persisted **29 course editions** across nine course categories.
- The `ALTRES` category (code `14`) includes concerts and is explicitly excluded in institution configuration.
- A two-record excerpt of the real language listing is saved in `tests/fixtures/miram-can-baste-languages.html` and tested with the shared parser.
- The metadata-only, attribution, unknown-field, and pre-publication reuse-review limitations documented above also apply here. Descriptions and images are not published.

The initial 29-edition Can Basté import missed plain pagination links. The corrected 2026-11-06 cloud refresh returned 99 editions. Its photography category alone has six numbered pages; the adapter allows at most 60 pages per source, with the existing 1,000-record bound and sequential rate limiting.

## Centre Cívic Pati Llimona

Verified on 2026-11-06:

- Official centre: https://patillimona.net/
- Official seasonal programme linking to registration: https://patillimona.net/tallers-de-tardor-2026/
- Registration: https://patillimona.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=1&t=AC
- Address: C/ del Regomir, 3, 08002 Barcelona, confirmed by the official centre and listing footer.
- `robots.txt` returned 404; the existing per-run policy check applies.
- The shared adapter fetched and persisted **56 course editions** across nine categories, including photography and cinema workshops.
- Reviewed external IDs `5036` and `5038` explicitly indicate cancellation. As of issue #13, they are retained and labelled on the next successful import; `5088` remains excluded as a film screening.
- Minimal real fixtures cover cinema course `5005` and the photography category's plain numbered pagination links. Whitespace around category headings is normalized.
- The same metadata-only collection and source reuse limitations above apply. Stock photography in the interface is separately licensed and is not scraped from course providers.

## Centre Cívic Casa Golferichs

Verified on 2026-11-06:

- Requested listing: https://golferichs.inscripcionscc.com/MiramModular/buscador/buscador.jsp
- Official centre programme: https://www.golferichs.org/cursos-i-tallers/ links directly to this registration host.
- Canonical course root: https://golferichs.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=29&t=AC
- Institution address: Gran Via de les Corts Catalanes, 491, 08015 Barcelona, confirmed on the official site and registration footer.
- Registration `robots.txt` returned 404. The existing adapter rechecks before each import.
- The unchanged shared Miram adapter validated **113 distinct course editions** over 40 pages within the existing 60-page/1,000-record bounds. The seven course categories are Ciències i humanitats, Cuina, Recursos, Creativitat, Expressió, Salut, and Espai de fotografia F. Català-Roca.
- Course scope is explicitly `g=1&c=29&t=AC`; the separate shows/conferences group is not crawled.
- Minimal real fixtures cover photography `7350` and cooking `7284`, including prices, local dates, and original mixed-case category values.
- The public category map folds photography into Fotografía/Fotografia, Cuina into Cocina/Cuina, Creativitat into art/creativity, Salut into physical activity/wellbeing, and Recursos into resources/creativity. Expression and sciences/humanities remain distinct, with Spanish/Catalan interface labels.
- The existing metadata-only collection, unknown availability/language, base-price/supplement, and reuse-review limitations also apply. No provider descriptions or photographs are published.

Cloud D1 holds 305 editions and 305 source records across the four imported centres. Discovery omits expired editions; course availability remains unconfirmed.

## Additional Miram sources — verified 2026-11-06

| Centre                | Source ID suffix        | Editions | Verified registration root                                                               |
| --------------------- | ----------------------- | -------: | ---------------------------------------------------------------------------------------- |
| La Casa Elizalde      | `casa-elizalde`         |      195 | https://casaelizalde.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=56&t=AC |
| Albareda              | `albareda`              |       27 | https://albareda.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=13&t=AC     |
| El Sortidor           | `el-sortidor`           |       50 | https://elsortidor.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=27&t=AC   |
| Vil·la Urània         | `vil-la-urania`         |      133 | https://vil-laurania.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=49&t=AC |
| Urgell                | `urgell`                |       42 | https://ccurgell.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=10&t=AC     |
| FAB Casa del Rellotge | `fab-casa-del-rellotge` |       14 | https://fabcasadelmig.miram.cloud/MiramModular/buscador/buscador.jsp?g=1&c=9903&t=CR     |
| FAB Casa del Mig      | `fab-casa-del-mig`      |       11 | https://fabcasadelmig.miram.cloud/MiramModular/buscador/buscador.jsp?g=1&c=9903&t=CM     |

All seven registration hosts returned 404 for `robots.txt`; the adapter rechecks before each live run. Official programme links, public municipal listings, and registration footers were used to establish institution identity and addresses. The same metadata-only collection, unknown availability/language, base-price/supplement, and reuse-review limitations above apply.

Casa Elizalde's main website still disallows general crawlers. Its officially linked `casaelizalde.inscripcionscc.com` host has a separate policy and provides the imported records; the blocked WordPress REST API is not used. Category `CO` is explicitly online-only and excluded. “Balls en línia” in the expression category is line dancing and is retained; online delivery is not inferred from that phrase.

El Sortidor category `TC` contains a musical show and is excluded; its family cooking workshop is included with its explicitly stated free price and single local date. Vil·la Urània exposes an advance-preview card with no stable edition identifier or dates, labelled with a future registration-opening notice. It is reported and omitted; no identity or schedule is invented. Urgell's uppercase headings and all new equivalent categories use the public category map.

The two FAB sources share `c=9903` and a host but use different activity types (`CR` versus `CM`) and separate institution/source IDs. Casa del Mig's meetups/talks category `02` is excluded. The user-supplied Miram URLs replace the former Casa del Rellotge official-link-only integration; its blocked main-site calendar remains unused.

The complete batch was assembled from real pages captured during manual live verification, with only missing pages fetched during subsequent parser validation. This avoided repeatedly fetching the same provider pages while resolving pagination and preview markup. Validated snapshots went through the authoritative ingestion runner for local and cloud persistence. They are not test fixtures or data-only SQL replays.

Cloud and local D1 each contain **777 editions with source records across 11 centres** after this batch (Fort Pienc was added later). Counts include expired editions; discovery omits those. The first four sources retain their earlier first-seen history. No fictional courses or inferred availability are published.

## Centre Cívic Ateneu Fort Pienc

Verified on 2026-11-08:

- Municipal entry: https://ajuntament.barcelona.cat/centrescivics/es/centre-civic/centre-civic-ateneu-fort-pienc, which links the official website https://www.fortpienc.org/.
- Registration: https://fortpienc.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=5&t=AC (linked from the official site; platform: Miram, the same shared adapter as the other centres).
- Address: Plaça Fort Pienc, 4-5, 08013 Barcelona, confirmed in the registration footer. Phone, email and coordinates come from the municipal guide entry https://guia.barcelona.cat/ca/detall/centre-civic-ateneu-fort-pienc_99043134828.html (`loadmapdetall` configuration; the phone matches the registration footer). `guia.barcelona.cat/robots.txt` sets a 10-second crawl delay and does not disallow the detail page.
- `fortpienc.inscripcionscc.com/robots.txt` returned 404; the adapter rechecks it on every run. The centre's own website `www.fortpienc.org` has `User-agent: *`, `Disallow: /` and `Crawl-delay: 300`. UrbanLabs does not collect from it. Its home page was fetched once, before that policy had been read, only to find the registration link; nothing else on that host was requested.
- The adapter, validation and normalization are unchanged; only `src/lib/sources/fort-pienc.ts` was added. The registration host offers three activity types: `AC` (Tallers Culturals, the course catalogue, seven categories), `BI` (itineraries) and `CE` (shows and talks). Only `AC` is configured; the adapter never follows links to other types.
- A live `source:verify` run on 2026-11-08 validated **62 course editions** without persistence. A one-card excerpt of the language listing is saved in `tests/fixtures/miram-fort-pienc-languages.html`.
- The same metadata-only collection, unknown availability/language, base-price (concession prices are not represented) and reuse-review limitations described above apply. Production ingestion is a separate, explicitly approved operation and has not been run.

## Investigated and deferred

### FAB Casa del Rellotge — official programme link

Requested programme: https://fabcasadelrellotge.cat/formacio/

Reviewed on 2026-11-06. The official page identifies training sections for capacitacions, maker workshops, older people, and families/young people. It uses WordPress/EventON calendars loaded dynamically; the initial HTML does not provide individual course records. No external registration feed was linked in the inspected page.

The host's `robots.txt` returned HTTP 200 with `User-agent: *`, `Disallow: /`, and `Crawl-delay: 300`. Its separate Googlebot/Bingbot exceptions do not apply to UrbanLabs. Automated collection stopped after that policy was read. No REST/AJAX endpoint, PDF, browser automation, or alternate user agent was used to collect courses.

The discovery page links directly to the official programme under “Otros espacios para aprender” / “Altres espais per aprendre”. The link is configured in `src/lib/institutions/linked-centres.ts`, outside the approved ingestion registry. No course dates, prices, availability, or D1 records were invented; this centre is not offered as a course filter. Importing individual editions requires permission from the centre or a permitted official feed. This linked-only centre does not contribute imported course editions or course-filter categories.

### Can Verdaguer

https://canverdaguer.com/

Investigated on 2026-11-06. The official site links to `canverdaguer.inscripcionscc.com`, but its Miram course listing (`g=1&c=24&t=AC`) was empty. It was not added as a course source; cultural events were not substituted for courses.

### Barcelona Open Data: civic-centre training

https://opendata-ajuntament.barcelona.cat/data/dataset/centres-civics-formacio

The dataset metadata describes annual aggregate statistics (activities, attendance, available area), not bookable course editions. It is unsuitable as a course feed. Its robots policy also disallows API paths and query-string crawling; no automated importer was implemented.

## Adding an institution

Verify its official website, registration-platform ownership, public-access rules, reuse conditions, and field semantics first. Reuse Miram extraction only after testing a small saved fixture against that institution's actual markup. A configuration-only addition is the target, not an unverified compatibility claim.

## Centre directory locations and contacts

Eleven centre locations and contacts were manually verified on 2026-11-06, and Fort Pienc's on 2026-11-08, against
Barcelona City Council's public municipal directory (`guia.barcelona.cat`). Exact
source URLs, coordinates and verification dates live in
`src/lib/institutions/profiles.ts`. Coordinates come from each official detail
page's `loadmapdetall(latitude, longitude, ...)` map configuration, without geocoding
or estimating an address. Public detail pages were fetched respecting the guide's
10-second crawl delay. Profile updates are reviewed explicitly, separately from
course extraction. FAB Casa del Mig's municipal entry currently reports temporary
closure; its page displays that notice without assuming courses are cancelled.

Directory and individual centre pages share a locally bundled Leaflet map component,
with OpenStreetMap raster tiles, verified markers and visible attribution. Centre
pages retain larger-map links and municipal location provenance. Unknown locations
show an address-search link and an explicit unverified-location message. There is
no runtime geocoding, map API key or paid map service. Leaflet and its CSS load only
when a map approaches the viewport. Without JavaScript, directory links and centre
location links remain available. Routine E2E tests intercept tile requests and
verify markers without contacting live map services.
