# Data source research

Research dates: 2026-11-05–06. Live results can change.

## Approved local research source: Miram / Centre Cívic Sant Andreu

- Official institution: https://ajuntament.barcelona.cat/ccivics/santandreu
- Public registration listing: https://santandreu.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=22&t=AC
- Platform: Miram Modular, shared with other civic centres.
- Institution configuration: the `cc-sant-andreu` record in `data/centres/es/barcelona.json`.
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
- Its categories are mapped to the public topics in `data/categories.json` (ADR 0009); mixed ones such as Creativitat and Recursos are classified by title.
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

Casa Elizalde's main website still disallows general crawlers. Its officially linked `casaelizalde.inscripcionscc.com` host has a separate policy and provides the imported records; the blocked WordPress REST API is not used. On 2026-11-09 the course catalogue (`AC`) was empty and only shows and talks (`CE`, out of scope) were offered, so the centre is marked `mayBeEmpty`. Category `CO` is explicitly online-only and excluded. “Balls en línia” in the expression category is line dancing and is retained; online delivery is not inferred from that phrase.

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
- The adapter, validation and normalization are unchanged; only the `cc-fort-pienc` registry record was added. The registration host offers three activity types: `AC` (Tallers Culturals, the course catalogue, seven categories), `BI` (itineraries) and `CE` (shows and talks). Only `AC` is configured; the adapter never follows links to other types.
- A live `source:verify` run on 2026-11-08 validated **62 course editions** without persistence. A one-card excerpt of the language listing is saved in `tests/fixtures/miram-fort-pienc-languages.html`.
- The same metadata-only collection, unknown availability/language, base-price (concession prices are not represented) and reuse-review limitations described above apply. Production ingestion is a separate, explicitly approved operation and has not been run.

## Centre Cívic Barceloneta, Baró de Viver and Can Castelló

Verified on 2026-11-08 on the shared Miram adapter:

| Centre                     | Source ID             | Editions | Verified registration root                                                                   |
| -------------------------- | --------------------- | -------: | -------------------------------------------------------------------------------------------- |
| Centre Cívic Barceloneta   | `miram-barceloneta`   |       72 | https://civicbarceloneta.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=51&t=AC |
| Centre Cívic Baró de Viver | `miram-baro-de-viver` |        5 | https://barodeviver.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=14&t=AC      |
| Centre Cívic Can Castelló  | `miram-can-castello`  |       21 | https://cancastello.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=32&t=AC      |

- Editions are the result of a live `source:verify`-style run without persistence on 2026-11-08 (Baró de Viver: 8 parsed cards, 3 excluded). Production ingestion has not been run.
- Registration hosts were found through municipal programme documents; each returned HTTP 404 for `robots.txt` (rechecked by the adapter on every run) and each footer names the centre and street address. The official municipal pages are `https://ajuntament.barcelona.cat/ccivics/barceloneta`, `/barodeviver` and `/cancastello`. Phone numbers, emails (where the municipal sources agree) and coordinates come from each centre's `guia.barcelona.cat` entry, respecting its 10-second crawl delay. Can Castelló's email is omitted because the municipal pages disagree.
- Each host also exposes a `CE` type (shows and talks) that is not followed; only `t=AC` (Tallers Culturals) is configured.
- Barceloneta's first category is the neighbourhood-programme label `#FEMBARRI`; it is kept verbatim. Prices of 0 are the explicit base price `Gratuït` or free programmes, not inferred.
- Baró de Viver lists three free childcare services ("Temps de dona: Acollida", IDs `2300`–`2302`) for another workshop's participants. They are single-session cards without the usual session accordion and without a year in their date. The adapter now falls back to the registration form's `activitat` identifier for such cards, keeping dates `null`, and configuration excludes these three IDs because they are not courses.
- The same metadata-only collection, unknown availability/language, base-price and reuse-review limitations described above apply.

## Centre Cívic La Sedeta, Navas, Parc Sandaru and Pere Pruna

Verified on 2026-11-10 on the shared Miram adapter:

| Centre                    | Source ID            | Editions | Verified registration root                                                                 |
| ------------------------- | -------------------- | -------: | ------------------------------------------------------------------------------------------ |
| Centre Cívic La Sedeta    | `miram-la-sedeta`    |       73 | https://cursoslasedeta.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=25&t=AC |
| Centre Cívic Navas        | `miram-navas`        |      151 | https://ccnavas.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=4&t=AC         |
| Centre Cívic Parc Sandaru | `miram-parc-sandaru` |       26 | https://sandaru.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=38&t=AC        |
| Centre Cívic Pere Pruna   | `miram-pere-pruna`   |       14 | https://ccperepruna.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=41&t=AC    |

- Editions come from a live `centre:probe --full` crawl without persistence; every record validated, none lacks a start date or price. Production ingestion is a separate, explicitly approved operation.
- The official municipal pages (`https://ajuntament.barcelona.cat/ccivics/lasedeta`, `/navas`, `/parcsandaru`, `/perepruna`) do not link the registration host, so the hosts were found through municipal programme documents and search results, then confirmed by each host's footer (centre name and street address). Each host returned HTTP 404 for `robots.txt`; the adapter rechecks it on every run.
- Phone numbers, addresses and coordinates come from each centre's `guia.barcelona.cat` entry (`loadmapdetall` configuration), respecting its 10-second crawl delay. Postcodes come from the registration footers. Navas is the exception: the guide gives Carrer de Las Navas de Tolosa, 312, while the registration footer prints Ptge. Doctor Torent, 1, 08027, so its postcode is omitted rather than guessed.
- Each host also exposes other types (`CE` shows and talks, and at Pere Pruna `BI` itineraries) that are not followed; only `t=AC` is configured. At Navas the `ITINERARIS` category (guided city walks with dates and prices) is part of `AC` and is kept. "Balls en línia" at La Sedeta is line dancing and is retained, as at Casa Elizalde. No exclusions were needed.
- Emails are omitted because the registration and municipal pages were not cross-checked.
- The same metadata-only collection, unknown availability/language, base-price and reuse-review limitations described above apply.

## Centre Cívic Trinitat Vella, Vallvidrera Vázquez Montalbán, Vil·la Florida, Zona Nord and Centre Cultural La Farinera del Clot

Verified on 2026-11-10 on the shared Miram adapter:

| Centre                                     | Source ID                             | Editions | Verified registration root                                                                     |
| ------------------------------------------ | ------------------------------------- | -------: | ---------------------------------------------------------------------------------------------- |
| Centre Cívic Trinitat Vella                | `miram-trinitat-vella`                |       22 | https://trinitatvella.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=42&t=AC      |
| Centre Cívic Vallvidrera Vázquez Montalbán | `miram-vallvidrera-vazquez-montalban` |       46 | https://ccvazquezmontalban.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=43&t=AC |
| Centre Cívic Vil·la Florida                | `miram-vil-la-florida`                |        9 | https://vflorida.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=50&t=AC           |
| Centre Cívic Zona Nord                     | `miram-zona-nord`                     |       36 | https://cczonanord.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=18&t=AC         |
| Centre Cultural La Farinera del Clot       | `miram-la-farinera-del-clot`          |       12 | https://lafarinera.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=20&t=AC         |

- Edition counts come from a live `centre:probe --full` crawl without persistence, after exclusions; every record validated. Only Trinitat Vella's "Rebosteria de tardor" lacks a start date (kept `null`); no record lacks a price. Production ingestion is a separate, explicitly approved operation.
- The official municipal pages do not link the registration hosts. The hosts were found by their `inscripcionscc.com` names and confirmed by each host's page title and footer (centre name and street address). Each host returned HTTP 404 for `robots.txt`; the adapter rechecks it on every run.
- Phone numbers, addresses and coordinates come from each centre's `guia.barcelona.cat` entry (`loadmapdetall` configuration), respecting its 10-second crawl delay. Postcodes come from the registration footers. La Farinera's official website is `farinera.org`, as listed in the guide; the others use their `ajuntament.barcelona.cat/ccivics/…` page.
- Full single-session cards at Trinitat Vella, Vallvidrera and Vil·la Florida carry neither a session accordion nor a registration form, so they expose no activity ID (and usually no dates). The adapter now skips such cards only when the footer says "Places exhaurides" or "En aquests moments no queden places online per aquesta activitat.", logging `ingestion_full_without_id_skipped`; any other identifier-less card still stops ingestion. A course seen earlier with an ID simply stops being refreshed while it is full.
- Exclusions: Trinitat Vella `1667` (theatre performance); Vallvidrera categories `CM` (concerts) and `XE` (talks) and `1575` (Festa Major opening); Zona Nord `1849` (film screening). Vallvidrera's environmental itineraries and family workshops are kept, as at Navas and El Sortidor.
- Vil·la Florida's `AC` type only lists cooking, family and balcony-garden workshops; the language, fitness and art workshops in the city guide are not published on this host, so they are not imported. Other types (`BI` itineraries, `CE` shows and talks) are not followed at any of these centres.
- Emails are omitted because the registration and municipal pages were not cross-checked.
- The same metadata-only collection, unknown availability/language, base-price and reuse-review limitations described above apply.

## Barcelona civic centres batch (issues #19–#49)

Verified on 2026-11-11 on the shared Miram adapter:

| Centre                                 | Source ID                       | Editions | Verified registration root                                                                 |
| -------------------------------------- | ------------------------------- | -------: | ------------------------------------------------------------------------------------------ |
| Centre Cívic Can Clariana Cultural     | `miram-can-clariana-cultural`   |       24 | https://canclariana.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=55&t=AC    |
| Centre Cívic Can Deu                   | `miram-can-deu`                 |      112 | https://cccandeu.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=44&t=AC       |
| Centre Cívic Can Felipa                | `miram-can-felipa`              |       41 | https://cccanfelipa.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=52&t=AC    |
| Centre Cívic Casa Groga                | `miram-casa-groga`              |       14 | https://casagroga.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=3&t=AC       |
| Centre Cívic Casa Orlandai             | `miram-casa-orlandai`           |       41 | https://casaorlandai.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=46&t=AC   |
| Centre Cívic Convent de Sant Agustí    | `miram-convent-de-sant-agusti`  |       33 | https://conventagusti.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=47&t=AC  |
| Centre Cívic Cotxeres Borrell          | `miram-cotxeres-borrell`        |       96 | https://cotxeresborrell.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=2&t=AC |
| Centre Cívic del Besòs i el Maresme    | `miram-besos-i-el-maresme`      |       54 | https://besos.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=15&t=AC          |
| Centre Cívic Bon Pastor                | `miram-bon-pastor`              |       12 | https://bonpastor.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=31&t=AC      |
| Centre Cívic Drassanes                 | `miram-drassanes`               |       49 | https://ccdrassanes.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=53&t=AC    |
| Centre Cívic El Carmel                 | `miram-el-carmel`               |       30 | https://carmel.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=28&t=AC         |
| Centre Cívic El Coll - La Bruguera     | `miram-el-coll-la-bruguera`     |       13 | https://ccelcoll.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=12&t=AC       |
| Centre Cívic Font de la Guatlla        | `miram-font-de-la-guatlla`      |       73 | https://laguatlla.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=21&t=AC      |
| Centre Cívic Guinardó                  | `miram-guinardo`                |       41 | https://guinardo.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=37&t=AC       |
| Centre Cívic Joan Oliver - Pere Quart  | `miram-joan-oliver-pere-quart`  |      109 | https://ccperequart.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=16&t=AC    |
| Centre Cívic l'Elèctric                | `miram-l-electric`              |       10 | https://cclelectric.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=40&t=AC    |
| Centre Cívic La Sagrera La Barraca     | `miram-la-sagrera-la-barraca`   |       42 | https://sagrera.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=23&t=AC        |
| Centre Cívic Sagrada Família           | `miram-sagrada-familia`         |      146 | https://sagradafamilia.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=39&t=AC |
| Centre Cívic Sant Martí                | `miram-sant-marti`              |       32 | https://santmarti.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=17&t=AC      |
| Centre Cívic Teixonera                 | `miram-teixonera`               |       39 | https://teixonera.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=19&t=AC      |
| Centre Cívic Tomasa Cuevas - Les Corts | `miram-tomasa-cuevas-les-corts` |       44 | https://lescorts.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=35&t=AC       |
| Centre Cívic Torre Llobeta             | `miram-torre-llobeta`           |        3 | https://torrellobeta.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=54&t=AC   |

- Edition counts come from a live crawl without persistence, after exclusions; every record validated. Unknown start dates are kept `null`: Tomasa Cuevas - Les Corts 9 (no parsable date range on the card), Sant Martí 3 (the same three also have no price). Production ingestion is a separate, explicitly approved operation.
- Hosts were found by their `inscripcionscc.com` names, municipal pages (Pere Quart and Tomasa Cuevas link theirs) and city-guide listings (El Coll, Font de la Guatlla), then confirmed by each host's page title and footer (centre name and street address). Every host returned HTTP 404 for `robots.txt`; the adapter rechecks it on every run.
- Phone numbers, addresses and coordinates come from each centre's `guia.barcelona.cat` entry (`loadmapdetall` configuration), respecting its 10-second crawl delay. Postcodes come from the registration footers. Official URLs are the municipal `ajuntament.barcelona.cat/ccivics/…` page, or the centre's own site where the guide lists one (Can Felipa, Casa Orlandai, Convent de Sant Agustí, Cotxeres Borrell, Sagrada Família).
- Parser: Cotxeres Borrell prints its full-card notice as "0 20/07/2026 Places exhaurides…", and Sant Martí shows an ID-less preview reading "Les inscripcions on-line les podreu fer a partir del …". Both exact forms are now recognised; any other identifier-less card still stops ingestion. Sant Andreu shows a similar "Podreu realitzar les inscripcions on-line…" footer on cards that do have IDs, so that wording is deliberately not treated as a preview.
- Exclusions: Guinardó categories `sm` (adult planetarium and telescope sessions), `GE` (stage performances) and `XP` (exhibition events), its family planetarium sessions `3861`–`3863`, `3874`, `3907`–`3909` and round table `3912` (the two family astronomy workshops stay); Sagrada Família category `RP` ("Parlem…" talks); Drassanes category `BD` (Barcelona Districte Cultural shows, including an ID-less preview); Sant Martí `2633` (children's film screening). Guided walks and itineraries (Sagrada Família `IT`, Pere Quart `SO`, Font de la Guatlla `09`) are kept, as at Navas.
- Not added yet: **Can Verdaguer (#22)**. `canverdaguer.inscripcionscc.com` (centre code 24) publishes only the `CE` shows-and-talks type. Re-checked on 2026-11-13: `CE` mixes talks and presentations with one-off workshops, and the `AC` listing is empty and not linked from the navigation. No course catalogue exists to import, and cultural events are not substituted for courses.
- Emails are omitted because the registration and municipal pages were not cross-checked.
- The same metadata-only collection, unknown availability/language, base-price and reuse-review limitations described above apply.

### Remaining Barcelona civic centres (issues #25, #28, #37, #39) — verified 2026-11-13

| Centre                                 | Source ID                         | Editions | Verified registration root                                                                  |
| -------------------------------------- | --------------------------------- | -------: | ------------------------------------------------------------------------------------------- |
| Centre Cívic Cotxeres de Sants         | `miram-cotxeres-de-sants`         |      218 | https://cotxerescasinet.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=34&t=AC |
| Centre Cívic Casinet d'Hostafrancs     | `miram-casinet-d-hostafrancs`     |      103 | https://cotxerescasinet.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=34&t=AC |
| Centre Cívic Josep Maria Trias i Peitx | `miram-josep-maria-trias-i-peitx` |       66 | https://ccjmtriasipeitx.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=45&t=AC |
| Centre Cívic La Cadena                 | `miram-la-cadena`                 |        0 | https://lacadena.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=33&t=AC        |

- Edition counts come from a live `source:verify` run (nothing stored). Every host returned HTTP 404 for `robots.txt`, and each was confirmed by its page title and footer.
- **Cotxeres-Casinet** is one Miram host for both centres. They are run under one municipal agreement by the Secretariat d'Entitats de Sants, Hostafrancs i la Bordeta. Every card names its room and building on an "Espai:" line, and the `venues` registration field keeps only the cards whose line contains one of the centre's texts:
  - **Casinet:** "Rector Triadó, 53", 103 cards.
  - **Cotxeres:** "Sants, 79" or "Bonet i Muixí", 218 cards. The barcelona.cat guide gives Plaça Bonet i Muixí 7 for Cotxeres, so its "Edifici C" and the Masia del Rellotge are counted as Cotxeres.
  - **Neither centre:** 56 cards held elsewhere are left out because their building belongs to neither centre: Institut Montserrat (C/ Cros 6-8), C/ Sant Roc 28, Mercat de Sants, C/ Mir i Geribert 8, MNAC, Plaça Cerdà, and the "Aula virtual" online sessions.
  - **Excluded category:** `20` (online workshops).
  - **Listing URL:** both sources read the same listing, so each `listingUrl` carries the centre slug as a fragment to stay unique. The adapter drops it.
  - **Crawl size:** the host has about 100 listing pages, so the Miram page bound is now 120. Each source crawls the host separately.
- **Josep Maria Trias i Peitx** now registers through `ccjmtriasipeitx.inscripcionscc.com` (centre code 45), found by a contributor on #37.
- **La Cadena:** the root page exposes centre code 33, and the `AC` listing is well formed but empty while the winter 2026 workshops are not yet online. The centre is marked `mayBeEmpty`, so an empty run is a normal success.
- **Fort Pienc and La Sedeta** (2026-11-14): the scheduled run of 2026-11-13 failed on both because their `AC` listings show no categories between the autumn and winter 2026 terms. Both are now `mayBeEmpty`, like La Cadena.
- **Can Basté** (2026-11-14): the same run failed on nine winter cards with no identifier and the footer "Podreu realitzar les inscripcions on-line a partir del 15/12/2026". This wording is now recognised as an unpublished preview and skipped.
- Phones, addresses and coordinates come from each centre's `guia.barcelona.cat` entry, and postcodes from the registration footers. The Casinet footer shows only the shared C/ Sants 79 address, so Casinet has no postcode. The shared `cotxeres-casinet@secretariat.cat` email appears both in the guide and in the registration footer, so it is kept for Cotxeres and Casinet. Trias i Peitx and La Cadena emails are omitted because the sources disagree.

## Alicante — Aula Abierta (municipal culture classes), paused

- Listing: https://w3.alicante.es/cultura/aula-abierta/consulta-cursos.php (optionally `?aula=<code>`); researched 2026-11-09.
- Platform: a server-rendered municipal PHP page, adapter `alicante-aula-abierta`. One request per classroom returns every course of that classroom, grouped by specialty. There is no per-course page or unique identifier: the `data-codigo` attribute is only unique inside a specialty heading and is occasionally reused, so the identity is `<code>-<specialty slug>-<title slug>` (documented in the adapter). Because the course title is part of the identity, a renamed course becomes a new edition and the old one ages out by its end date.
- `https://w3.alicante.es/robots.txt` returned HTTP 404; the adapter rechecks it before every import.
- Data used: title, specialty (category), dates (`dd-MM-yyyy`, one or two), weekday and time text, and the explicit "Gratuito" label (price 0). Every other price stays unknown: the page also marks some courses `pago_monitor`, which is not interpreted. Classroom address and phone come from the listing header. No coordinates were verified, so these centres show the honest "location not verified" fallback.
- Six in-person classrooms are registered in `data/centres/es/alicante.json`: Chalet Ingeniero de Tranvías (301), Francisco Liberal (302), Juan XXIII 2º Sector (402), Plaza de Argel (401), Centro Comunitario Playas (601) and Centro Municipal de las Artes (103). "AULA ONLINE" (701) is outside the in-person directory and is not registered.
- **Permission pending.** The Ayuntamiento's legal notice (https://www.alicante.es/es/contenidos/aviso-legal) allows free reproduction for non-profit purposes by people at educational or research institutions, citing the source; other institutions, bodies and companies need written permission. UrbanLabs does not qualify automatically, so every Alicante centre carries `pausedReason` and is **not ingested, scheduled or published** until permission is granted. A draft request is in `docs/alicante-permission-request.md`. Once granted, remove `pausedReason` from the records and refresh through the normal workflow.

## Tarragona — Centres Cívics (municipal network), paused

Researched 2026-11-10; five centres registered in `data/centres/es/tarragona.json`: Bonavista (`c2`), Llevant (`c6`), Sant Pere i Sant Pau (`c3`), Sant Salvador (`c4`) and Torreforta (`c1`). Adapter `tarragona-centres-civics`.

- **Where the data is.** The programme is published on `www.tarragona.cat/centrescivics` (a CMS whose term path, e.g. `t2026`, changes every season). The "Activitats i cursos monogràfics" catalogue has one page per category, and every workshop links to its activity page on `inscripcions.tarragona.cat`, which carries a schema.org `Event` plus visible blocks (dates, times, place, price). The adapter finds the newest catalogue from the stable index page, reads the category pages, and fetches only the activity pages whose code contains the source's `c<N>` centre number.
- **Access.** `tarragona.cat/robots.txt` exists but only restricts named agents (`User-agent: *` has an empty `Disallow`); the adapter re-checks this every run and stops on any stricter policy. `inscripcions.tarragona.cat/robots.txt` returns 404. The registration home page `centrescivics.tarragona.cat` answers automated clients with a Cloudflare block (HTTP 403); that access control is not bypassed and the host is not used. The public listing at `inscripcions.tarragona.cat/ca` does not list the civic-centre activities, so it is not used either.
- **Identity.** The internal activity code (e.g. `c2t26ac1ae`) is shared by different courses of one centre ("BATXATA - iniciació/continuació"), so the activity page slug is the `externalId`. The `Event` name embeds that code, which is stripped from the title. The `startDate` in the structured data carries a wrong UTC offset, so dates and times come from the visible "Data i hora" block; times are stored verbatim and no weekday or recurrence is inferred.
- **Price.** The visible "Preu" block gives the base price (`68.5€`) or "Gratuït" (0); discount codes (50 %, 25 %) are not represented. Anything else stays unknown.
- **Scope.** Only the monogràfics catalogue (courses and workshops). Exhibitions, talks, outings (`c5`, no centre), SCAN, URV and other programme sections are not followed. A live read-only run validated 50 activities (Bonavista 8, Llevant 12, Sant Pere i Sant Pau 8, Sant Salvador 12, Torreforta 10), none without dates or price.
- **Profiles.** Address, phone, email and coordinates come from each centre's page on `tarragona.cat` (`/centrescivics/centres-civics/...`).
- **Permission pending.** The Ajuntament's legal notice (https://www.tarragona.cat/avis-legal) allows the user to use the site's material "únicament i exclusivament per al seu ús personal" and does not allow reproduction, distribution or public communication of its content without authorization. UrbanLabs republishes course metadata, so all five centres carry `pausedReason`: validated but **not ingested, scheduled or published** until written permission is granted. A draft request is in `docs/tarragona-permission-request.md`.

## Zaragoza — Centros Cívicos (municipal network)

Researched 2026-11-12 (issue #99); 23 centres registered in `data/centres/es/zaragoza.json`. Adapter `zaragoza-centros-civicos`.

- **Where the data is.** The city's public events API publishes one programme per season ("Cursos y talleres Centros Cívicos 2026-2027", programme `2425`). The adapter finds the newest one by title (`/sede/servicio/actividades/evento/programa-list.json?q=title==*Centros*&sort=id desc`) and reads one listing per centre (`/sede/servicio/cultura/evento/list.json?program.id=<id>&idLugar=<facility id>&rows=500&sort=id asc`). Without `sort`, paging repeats rows, and a listing whose `totalCount` exceeds what one request returned is rejected rather than paged.
- **Records.** Each course is an event with a stable numeric id (the external id), one location (the centre's facility id, checked against the source), season dates (2026-09-07 to 2027-06-20), weekly sessions (`openingHours`) and the source category. Session notes in the description ("1 jueves al mes") are kept in the schedule text. The official URL is the course page on `zaragoza.es`. The courses are run by local associations selected in the city's "Actividades Estables" call; enrolment is with the organiser, and no price is published, so the price stays unknown. The organiser's name (`organizer[0].title`) is stored so cards can say whom to ask about the price; its phones, emails and addresses are not collected (some are personal), and the linked course page on `zaragoza.es` shows them.
- **Scope.** Rehearsals, meetings and members' days of resident groups ("Ensayo …", "Reuniones …", "Día del socio") share the programme and are left out. On 2026-11-12 the 23 listings held 852 events, 823 of them courses.
- **Profiles.** Address, phone, email and WGS84 coordinates come from the city's facility directory (`/sede/servicio/equipamiento/list.json?srsname=wgs84`); the facility id equals the events' `idLugar`, and each centre's page is `/sede/servicio/equipamiento/<id>`.
- **Access.** `www.zaragoza.es/robots.txt` disallows `/api/`, `/buscador/`, `*.csv`, `*.geojson` and other paths for `User-agent: *`. The JSON paths above are not disallowed; the adapter checks each requested path against the generic rules on every run and stops if one becomes disallowed.
- **Reuse.** The legal notice (https://www.zaragoza.es/sede/portal/aviso-legal#condiciones) allows commercial and non-commercial reuse under Ley 37/2007, on condition of citing the source ("Origen de los datos: Ayuntamiento de Zaragoza") and the last update date, not distorting the information and not suggesting endorsement. Course cards link to the official page with their verification date, and the site footer carries the attribution. The centres are active (not paused).

## Girona — Centres Cívics (municipal network)

Researched 2026-11-12 (issue #111); 8 civic centres registered in `data/centres/es/girona.json`. Adapter `girona-centres-civics`.

- **Where the data is.** The Ajuntament's registration system (https://seu.girona.cat/si/activitats/consulta) lists its current offers; the civic-centre network's is "Cursos i tallers de la Xarxa de Centres Cívics 2026-2027" (offer `181`, registration 17/09/2026 – 30/06/2027). The adapter finds the newest offer by that title. The offer page (`/si/activitats/consulta2/<offer>`) lists every activity of the network in one server-rendered page (667 on 2026-11-12) and redirects to the index without the session cookie the index sets, so the fetcher keeps that cookie for the run. Each activity's detail fragment (`/si/activitats/consulta3/<id>`) needs no session and is the course's official link.
- **Records.** The numeric detail id is the external id (activity codes such as `BV26258` are occasionally repeated). The listing gives the code, title, group (the source category, e.g. "Dansa i ball - anuals") and free places; the detail gives the period, the schedule text and the tariffs. "Places lliures: 0" marks the course as sold out. Only an explicit `Preu públic: N €` is a price; per-term (`PREU TRIMESTRAL`, `PREU PÚBLIC TRIMESTRE`), monthly and members' prices stay unknown, since they are not the price of the listed period.
- **Centres and venues.** The two letters of the code name the managing civic centre (BV Barri Vell-Mercadal, ON Onyar, PA Pla de Palau, PM Pont Major, SN Sant Narcís, SE Santa Eugènia, TE Ter). A centre lists the courses at its own venue and those it runs elsewhere under its prefix (local socials, Espai Cívic Mercadal, Can Gibert del Pla…); for those, the card's schedule names the venue. Pedret's courses carry the PM prefix but are held at Pedret, so Pedret has no prefix and another civic centre's venue is never claimed by prefix.
- **Profiles.** Addresses and phones come from https://web.girona.cat/ccivics/localitzacio; emails and coordinates (the official map on each centre's page) from `https://web.girona.cat/ccivics/<centre>`.
- **Access.** `seu.girona.cat` has no robots.txt (404); the adapter honours one if it appears. A refresh reads the offer index and listing (~1 MB) once per centre and one small fragment per course, about 670 fragments a day at one request per second.
- **Reuse.** The legal notice (https://web.girona.cat/avislegal) says "Podeu reutilitzar els continguts que apareixen en aquest web sempre que respecteu els límits permesos a la corresponent llicència Creative Commons", without naming the licence. UrbanLabs publishes course facts only (no descriptions or teacher names), links each card to the official page and credits the Ajuntament de Girona in the footer. The centres are active.

## Vitoria-Gasteiz — Centros Cívicos (municipal network), paused

Researched 2026-11-13; the 14 civic centres registered in `data/centres/es/vitoria-gasteiz.json` (Abetxuko, Aldabe, Arana, Ariznabarra, Arriaga, El Campillo, El Pilar, Hegoalde, Ibaiondo, Iparralde, Judimendi, Lakua, Salburua, Zabalgana). Adapter `vitoria-gasteiz-actividades`.

- **Where the data is.** The sede electrónica's activity search (`https://sedeelectronica.vitoria-gasteiz.org/m01-10s/actividadAction.do`), server-rendered HTML. The start page (`accion=inicio`) links with the current season (`anio=2026` for 2026-27). Per centre (`accion=verCentros&cen=<n>`) it lists the centre's activities; each activity lists its groups at the centre, 20 per page (`nuevaPag`); each group has a detail page with the fields below. The adapter follows every page and rejects an activity whose groups do not add up to the listed total.
- **Records.** The group id (`2026||4||AGIA||2||1`: season, centre, activity, group, part) is the external id (`2026-4-AGIA-2-1`) and its detail page the official URL. The detail gives the title, centre (checked against the source's venue, e.g. `C.C. IPARRALDE`), dates, weekdays (`L`, `M`, `X`, `J`, `V`, `S`, `D`, written out; unknown codes kept verbatim), times and free places ("0" is sold out, "--" unknown). The listing's status marks cancelled groups. Descriptions, requirements, material costs and age limits are not imported. No source category is kept yet (`category: null`), so every course is "altres" until a reviewed mapping exists.
- **Price.** The price is the "TARIFA NORMAL" for joining on the first day (the first tariff column, whose date must equal the start date): the whole course. Members' (abonado/a), age and unemployment tariffs and later joining dates are not represented. `0.0 €` is free.
- **Scope.** Only the 14 civic centres. The search also lists sports facilities (polideportivos, frontones), BIZAN senior centres (open to their card holders) and other venues, which are not registered.
- **Live check.** A read-only run on 2026-11-13 for Iparralde returned 197 groups across 87 activities, all valid, all with dates and price (5 free), 59 sold out. It took 10.7 minutes at one request per second (one listing, ~87 activity pages and ~197 detail pages), so before unpausing, check the batch size against the ingestion job's 30-minute timeout.
- **Profiles.** Address and phone come from each centre's page on `www.vitoria-gasteiz.org` (no postcode or coordinates are published there, so none are stored).
- **Access.** `/robots.txt` redirects to `/portal/robots.txt`, whose `User-agent: *` group disallows the control panel, `/j07-01s/J07GetFileServlet?` and `/cas/login?`, not the activity search; the adapter checks the requested path on every run. The city's open-data catalogue has no current course dataset (the CC BY "Actividades c. cívicos e instalaciones deportivas" is a 2019 statistics sheet).
- **Permission pending.** The sede's legal notice (https://sedeelectronica.vitoria-gasteiz.org/portal/es/aviso-legal) says "Todos los derechos están reservados. No está permitida la modificación de la web ni de sus contenidos." and names no reuse licence. All 14 centres carry `pausedReason`: validated but **not ingested, scheduled or published** until written permission is granted. A draft request is in `docs/vitoria-gasteiz-permission-request.md`.

## El Prat de Llobregat — Guia de cursos i tallers (municipal)

Researched 2026-11-13; the 3 civic centres registered in `data/centres/es/el-prat-de-llobregat.json` (Jardins de la Pau, Sant Jordi - Ribera Baixa, Palmira Domènech). Adapter `el-prat-cursos`.

- **Where the data is.** One course guide for the whole city on `www.elprat.cat` (`/la-ciutat/guia-cursos-i-tallers`), server-rendered Drupal pages: six course cards per page, followed through the pager's "next" item (12 pages, 67 courses on 2026-11-13). Each card gives the course page, its type ("Cuina", "Dansa"… the source category), the centre (linked by the centre's page, which is the source's `centrePage`) and an "Activitat Cancel·lada" mark. Each course page gives "Quan" (dates and times) and "Inscripció" (price). A centre's source reads every guide page and only its own course pages; the course page slug is the external id and the page is the official URL.
- **Records.** Dates: "Del 06/10/2026 al 01/12/2026 …" gives start and end; a single date ("13/11/2026 Divendres, de 18 a 20 h (1 sessió)") is a one-day course; anything else stays unknown. The schedule is the "Quan" text without its dates (times written inside a date range are kept). Price: "37€ 9 sessions", "24€" and "12,50 €" are prices for the listed course; "Inscripció gratuïta" and "Gratuït" are free; anything else, including an empty block, stays unknown. The guide shows no free places, so nothing is marked sold out; registration open/closed is not stored. Descriptions, organisers and course images are not imported.
- **Categories.** The guide's types are mapped in `data/categories.json` (e.g. "Informàtica, internet i noves tecnologies" → tecnologia, "Manualitats" → arts i manualitats); "Altres" stays unmapped.
- **Scope.** Only the three civic centres. The guide also lists the Centre de Promoció Econòmica's employment courses (often without schedule or price) and single courses at other municipal venues, which are not registered.
- **Profiles.** Address, phone, email and coordinates (the "Adreça" map link) come from each centre's page on `www.elprat.cat`. The site gives no postcode for the centres, so none is stored.
- **Access.** `robots.txt` disallows Drupal system paths (`/admin/`, `/search/`, `/user/…`) for `User-agent: *`, not the guide, and sets `Crawl-delay: 10`; the adapter waits 10 seconds between requests and re-checks the guide path on every run. A centre's refresh is ~12 listing pages plus its course pages (about 30 requests, 5–6 minutes).
- **Reuse.** The legal notice (https://www.elprat.cat/avis-legal-i-politica-de-privacitat) says "L'Ajuntament del Prat de Llobregat permet la reutilització dels continguts i de les dades, quan no s'indiqui el contrari, sempre que no s'alteri el contingut de la informació, no es desnaturalitzi i s'esmenti la font". It does not allow the city's logos or coats of arms, which are not used. UrbanLabs publishes course facts unaltered, links each card to the official page and credits the Ajuntament del Prat de Llobregat in the footer. The centres are active.

## Sabadell — Centres Cívics (municipal network), paused

Researched 2026-11-13 (issue #118); 13 civic centres registered in `data/centres/es/sabadell.json`. Adapter `sabadell-centres-civics`.

- **Where the data is.** One Joomla blog on `web.sabadell.cat` lists the long-running courses and workshops of every civic centre ([Cursos i tallers](https://web.sabadell.cat/activitats-subhome/activitats-llarga-durada-als-centres-civics-cursos-i-tallers), 10 per page via `?start=`; 33 pages on 2026-11-13). Each card links an article (`index.php?option=com_content&view=article&id=<id>`) whose "Data i Horari" gives "De dilluns 14 de setembre de 2026 a divendres 23 de juliol de 2027" and "Horari: dimecres de 20:15 a 21:15 h", whose "Lloc" links the venue's directory entry (`fitxes-repertori … id=25735`) and whose "Organitza" names the entity running it. The per-centre search is a POST form with a token, so the adapter reads the whole catalogue once per process (cached for an hour) and each centre's source keeps the articles whose venue id is its `venueCode`.
- **Records.** The article id is the external id; its page is the official URL. Dates are read only from a full "De … a …" range (Catalan month names, including elided "d'octubre"); anything else stays unknown. The organiser is stored; no price is published (many courses are run by neighbourhood associations), so it stays unknown. No source category is kept yet. The per-course iCalendar export (`com_iasicalendar`) is not used: its `DTSTART`/`DTEND` are not the course dates.
- **Live check.** A read-only run on 2026-11-13 read the whole catalogue in 9.9 minutes: 327 activities, all valid and with dates and schedule, across 11 centres (Can Rull 47, Concòrdia 44, Can Llong 42, Sant Oleguer 42, Creu Alta 41, Plans Molina 39, Ca n'Oriac 32, Parc del Nord 15, Torre-romeu 14, Can Puiggener 7, Gràcia 4). Creu de Barberà and Poblenou listed none, so they carry `mayBeEmpty`. Torre-romeu and Can Puiggener name no organiser.
- **Access.** `web.sabadell.cat/robots.txt` returns 404; the adapter honours one if it appears.
- **Profiles.** Address and phone from each centre's page (`/centres-civics-relacio/<centre>`); no coordinates are published there.
- **Permission pending.** The [Condicions d'ús](https://web.sabadell.cat/condicions-d-us) say "queden prohibides la reproducció —excepte per a l'ús privat—, transformació, distribució, comunicació pública … de tot o part dels continguts". All 13 centres carry `pausedReason`: validated but **not ingested, scheduled or published** until written permission is granted. A draft request is in `docs/sabadell-permission-request.md`.

## Madrid — Centros culturales de distrito (open dataset), paused

Researched 2026-11-12 (issue #98); 83 district cultural centres registered in `data/centres/es/madrid.json`. Adapter `madrid-datos-cursos`.

- **Where the data is.** The open dataset [Cursos y talleres en los centros culturales de los distritos](https://datos.madrid.es/dataset/50064-0-talleres-culturales-cursos) (CC BY 4.0). CKAN `package_show` lists dated CSV/JSON/XML snapshots; the adapter takes the CSV with the newest `last_modified` (semicolon-separated, UTF-8 with BOM). One row per course group: centre (`ORGANISMO_DESC`), activity, group, audience, places and a duration and start time per weekday. The snapshot is read once per process (cached for an hour) and each centre's source keeps the rows whose trimmed `ORGANISMO_DESC` is its `organism`.
- **Records.** Title is `ACTIVIDAD_DESC`; the schedule is built from the weekday columns ("Lunes y miércoles, 19:00 (1 hora)"). The dataset has no course dates, prices, pages or ids: dates and price stay unknown and the official URL is the centre's madrid.es page. Identity is the activity, group and audience (the same group name exists for children and adults), as a slug plus a hash of the exact source values; a renamed activity or group becomes a new edition. `NUM_PLAZAS_LIBRES` = 0 is stored as sold out (an explicit count on the snapshot date). No source category is kept yet, so topics come from titles only.
- **Snapshot check.** The 2026-11-11 snapshot (6,345 rows, 84 centres) maps to 6,305 valid records with unique ids per centre; 3 groups list no weekday and get no schedule.
- **Centres.** Matched by hand-reviewed name and district to the [Centros culturales municipales](https://datos.madrid.es/dataset/200304-0-centros-culturales) directory (CC BY 4.0), which gives the name, address, coordinates and madrid.es page. "C.C. USERA" (40 rows) is left out: the directory has both "Centro Cultural Usera 1" and "Usera 2" and the dataset does not say which.
- **Access blocked.** On 2026-11-13 `datos.madrid.es/robots.txt` started disallowing `/api/`, `/dataset/*/resource/*` and any query string for `User-agent: *`, with `Crawl-delay: 10`; the legacy `/egob/catalogo/…` URLs redirect to the blocked downloads, and datos.gob.es links to the same files. The district registration catalogue on sede.madrid.es answers "Access Denied" (Akamai) to automated clients. All 83 centres carry `pausedReason`: validated but **not ingested, scheduled or published** until automated access is allowed. The adapter checks robots.txt for both the API and the CSV path, so it stops on its own while the rules stand. A draft request is in `docs/madrid-permission-request.md`.
- **Attribution.** `data/geography.json` gives Madrid a `dataCredit` for the CC BY 4.0 notice.

## Reus — Xarxa de Centres Cívics (municipal network), paused

Researched 2026-11-13; the 7 civic centres registered in `data/centres/es/reus.json` (del Carme, Gregal, Llevant, Mas Abelló, Mestral, Migjorn, Ponent). Adapter `reus-inscripcions`.

- **Where the data is.** The city's registration platform `inscripcions.reus.cat` (the "inscribirme" platform also used by Tarragona, with another page template). The home listing filtered to the Centres Cívics department (`?page=<n>&depart=6&…`) shows 21 cards per page (7 pages, 143 activities on 2026-11-13); each card names the centre ("Centre Cívic Migjorn", sometimes with ", Reus"). The adapter follows the pages while a "Next" link exists and reads only the source centre's activity pages.
- **Records.** The page slug is the external id and the page the official URL. Each activity page has a schema.org `Event` (name, place, offers with availability) and visible blocks: "Data i Hora" ("Dimarts, 24 Novembre 2026 - Dimarts, 02 Febrer 2027" and "19:45h - 21:15h"), "Lloc" and "Preu" ("55.65€", "Gratuïta"). Dates come from the visible block; the times are stored verbatim and no weekday or recurrence is inferred. The trailing "– CC <centre>" is removed from titles. Sold out only when every offer is `SoldOut`; cancelled when `eventStatus` is `EventCancelled`. Only a single exact price (or "Gratuït/Gratuïta") is kept. The activity page's place must match the card's centre; titles can name another centre ("TAST DE CERVESES - CC DEL CARME" at Migjorn), and the place wins. No source category is kept yet (the cards' hashtags, e.g. #Formatives, #Salut, are not mapped).
- **Scope.** The department lists courses, one-off workshops, talks and visits together; they are not told apart yet.
- **Access.** `inscripcions.reus.cat/robots.txt` disallows account, booking, payment, `/api/` and `/ajax/` paths for `User-agent: *`; the adapter checks the listing and each activity path on every run.
- **Profiles.** Address, phone, email and coordinates come from the network page on reus.cat ([Centres Cívics](https://www.reus.cat/centres-civics)); Gregal has no page of its own there, so its official URL is that network page.
- **Permission pending.** The [avís legal](https://www.reus.cat/avis-legal) allows the content only "exclusivament per al seu ús personal, privat i no lucratiu" and subjects any other use to "prèvia i expressa autorització". All 7 centres carry `pausedReason`: validated but **not ingested, scheduled or published** until written permission is granted. A draft request is in `docs/reus-permission-request.md`.

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

### Other cities — reviewed 2026-11-13

One request per site (robots.txt and the listing page) with curl's default user agent. No block was bypassed, and nothing was imported. Revisit when the site or its policy changes.

| City                     | Source                                                                        | Problem found                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pamplona (Civivox)       | pamplonaescultura.es → `alaia.pamplona.es/publico/portal/listadoeventos.aspx` | The WordPress site allows everything in robots.txt but has no course records. Courses are in an iframe to the Alaia portal, and that portal answers non-browser clients (robots.txt included) with a 302 to www.pamplona.es. Blocked for automated clients.                                                                                                   |
| Donostia / San Sebastián | donostiakultura.eus (Donostia Kultura, ~600 courses a year)                   | robots.txt allows paths without a query string, but Cloudflare answers every page with a 403 challenge ("Attention Required"). Blocked.                                                                                                                                                                                                                       |
| Valencia                 | universitatpopular.com (Universitat Popular)                                  | Cloudflare managed challenge on every path, robots.txt included. Blocked.                                                                                                                                                                                                                                                                                     |
| Bilbao                   | bilbao.eus (municipal courses and the open-data catalogue)                    | robots.txt has `User-agent: *` / `Disallow: /` for the whole host. No course dataset was found in the open-data catalogue, which is on the same host.                                                                                                                                                                                                         |
| Granollers               | granollers.cat (Xarxa de Centres Cívics)                                      | The programme is published only as a seasonal PDF. `inscripcions.granollers.cat` redirects to an AOC login.                                                                                                                                                                                                                                                   |
| Cornellà de Llobregat    | agenda.cornella.cat                                                           | No robots.txt (404), and the activity pages (`fitxa.aspx?idAct=`) are readable HTML with labelled fields (Quan, Horari, Organitza, venue). However, the training category ("Mapa capacitació") listed only two library workshops. The civic-centre courses are published as seasonal PDFs. Not worth an adapter yet. `inscripcions.cornella.cat` returns 403. |
| Gijón                    | gijon.es (Universidad Popular)                                                | Only per-district PDF agendas and leaflets. Registration goes through the citizen card or app. No structured listing was found.                                                                                                                                                                                                                               |
| Valladolid               | valladolid.es (centros cívicos)                                               | One PDF programme per civic centre. No structured listing was found.                                                                                                                                                                                                                                                                                          |
| Lleida                   | paeria.cat (centres cívics and locals socials)                                | Yearly PDF activity guide. Some registrations go through neighbourhood associations. No structured listing was found.                                                                                                                                                                                                                                         |
| Terrassa                 | terrassa.cat                                                                  | Registration is through the e-government portal (seuelectronica). No public course listing was found.                                                                                                                                                                                                                                                         |

The Tarragona/Reus registration platform was also probed under `inscripcions.<town>.cat` for 18 Catalan towns:

- Granollers (login) and Cornellà (403) are covered in the table above.
- Lleida (`inscripcions.paeria.cat`) and Salt failed TLS verification and were not inspected further.
- Rubí timed out.
- The remaining 13 hosts do not resolve.

No other town on that platform was found.

## Adding an institution

A centre is one JSON record in `data/centres/<country>/<city>.json` (lower-case ISO country, seeded city ID; for example `es/barcelona.json`). The registry (`src/lib/centres/registry.ts`) validates every record with Zod when it loads, and the approved sources and reviewed profiles are generated from it. No per-centre code is needed for a platform that already has an adapter.

1. Find the centre's registration link from its official website or the municipal directory. Do not guess hosts.
2. Run `npm run centre:probe -- <registration URL>`. It checks `robots.txt` (stopping if a policy exists), reads the public navigation and footer, and prints a draft record. Add `--full` for a bounded, rate-limited crawl without persistence that lists category counts and sample titles for review.
3. Complete every `TODO` by hand from official sources: identity, official URL, address, phone, email, and coordinates with their source URL and verification date. The schema rejects drafts that still contain placeholders, and it never prefills profile values.
4. Document each exclusion (shows, online-only workshops, services) with a `reason`; exclusions without one fail validation. Registration hosts must be `https` on an approved Miram host (`*.inscripcionscc.com`, `*.miram.cloud`).
5. For a new city, create the file and import it in `src/lib/centres/registry.ts`; a test fails if a data file is not registered or a record sits in the wrong file.
6. A centre whose source may not be reused yet gets `pausedReason` (a documented reason). It stays validated in the registry but is excluded from `sources`, so it is never ingested, scheduled or published.
7. For a seasonal centre that can legitimately publish no courses, set `registration.mayBeEmpty: true`. A well-formed empty listing is then a successful run with zero editions (existing editions are kept and age out by their end dates); a broken or changed page still fails. Verify on the live site that the listing is empty before setting it.
8. Add a saved one-card fixture only if the centre's markup differs from existing fixtures, then document verified behaviour in this file.

Reuse Miram extraction only after the probe shows the standard markup. A different platform needs its own adapter and a new member of the `registration` union in `src/lib/centres/schema.ts`.

## Centre directory locations and contacts

Eleven centre locations and contacts were manually verified on 2026-11-06, and those of Fort Pienc, Barceloneta, Baró de Viver and Can Castelló on 2026-11-08, against
Barcelona City Council's public municipal directory (`guia.barcelona.cat`). Exact
source URLs, coordinates and verification dates live in
the `profile` of each record in `data/centres/`. Coordinates come from each official detail
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
