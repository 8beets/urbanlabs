# Fixture provenance

`miram-pati-llimona-cancelled.html` contains minimal excerpts of real activities
`5036` and `5038`, fetched on 2026-11-07 from:

https://patillimona.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=1&t=AC&f=11

The source titles explicitly use `CANCEL·LADA` and `CANCEL.LAT`, and both prices
are `Gratuït`. Descriptions and session contents were removed. The existing FAB Casa
del Mig fixture preserves activity `674` with its explicit description notice
`ACTIVITAT ANUL·LADA TEMPORALMENT FINS A NOU AVÍS` and nonzero source price; the same
notice was verified live on 2026-11-07 for `674` and `666`. E2E changes dates only in
isolated test state. These fixtures do not assert current availability.

`miram-sant-andreu-languages.html` is an excerpt of the public language-category listing fetched on 2026-11-05:

https://santandreu.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=22&t=AC&f=ID

It preserves the actual course markup and four external IDs (1725, 1723, 1724, 1726). Contact/footer content and unrelated scripts were excluded. It is a historical source fixture, not a claim of current availability. Source prose appears only in this isolated test artifact and is not published by the application or imported as descriptions.

Tests mutate this saved fixture in memory to exercise missing IDs, malformed prices, and pagination. These mutations are synthetic test cases, not verified source variants.

`miram-can-baste-languages.html` contains two actual course cards (IDs 3825 and 3824) from the public Can Basté language listing, retrieved on 2026-11-06. The excerpt was serialized with Cheerio, preserving course values but normalizing HTML syntax:

https://canbaste.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=30&t=AC&f=07

Browser tests seed synthetic future dates and extra records in `.wrangler/e2e-state`, served only by the isolated test server on port 4322. They never seed `.wrangler/state`, which holds the app's real browsing data.

`miram-pati-llimona-cinema.html` contains actual course `5005` from Pati Llimona's public CINEMA listing, retrieved 2026-11-06:

https://patillimona.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=1&t=AC&f=2

`miram-pati-llimona-pagination.html` contains one actual photography course, its whitespace-padded heading, and the original unstyled anchors for pages 1–3, from the same host's `f=1` listing. Both excerpts were serialized with Cheerio; contact details, scripts, and unrelated content were removed. E2E dates are changed only in isolated test state.

`miram-golferichs-photography.html` and `miram-golferichs-cooking.html` are one-card excerpts from the public Golferichs listings, retrieved on 2026-11-06:

- https://golferichs.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=29&t=AC&f=XX — photography course `7350`.
- https://golferichs.inscripcionscc.com/MiramModular/buscador/buscador.jsp?g=1&c=29&t=AC&f=CU — cooking course `7284`.

They preserve the original category heading, category selector, and course markup, serialized with Cheerio. Scripts, contact details, and unrelated cards were removed; trailing whitespace was stripped. Browser fixtures change dates only in isolated E2E state.

## Seven-centre expansion (2026-11-06)

These are minimal real course-card excerpts from the approved Miram registration hosts, serialized with Cheerio. Contact details, scripts, and unrelated content were removed. Original course values are preserved; whitespace and HTML syntax were normalized.

| Fixture                            | Host / category                                     | External ID |
| ---------------------------------- | --------------------------------------------------- | ----------- |
| `miram-casa-elizalde.html`         | `casaelizalde.inscripcionscc.com`, `c=56&t=AC&f=H2` | 10051       |
| `miram-albareda-music-first.html`  | `albareda.inscripcionscc.com`, `c=13&t=AC&f=02`     | 2264        |
| `miram-albareda-music-next.html`   | Same category, `p=1`                                | 2267        |
| `miram-sortidor-family.html`       | `elsortidor.inscripcionscc.com`, `c=27&t=AC&f=TI`   | 3412        |
| `miram-vil-la-urania.html`         | `vil-laurania.inscripcionscc.com`, `c=49&t=AC&f=AC` | 8583        |
| `miram-urgell.html`                | `ccurgell.inscripcionscc.com`, `c=10&t=AC&f=H`      | 6864        |
| `miram-fab-casa-del-rellotge.html` | `fabcasadelmig.miram.cloud`, `c=9903&t=CR&f=01`     | 675         |
| `miram-fab-casa-del-mig.html`      | Same host, `c=9903&t=CM&f=01`                       | 674         |

All roots use HTTPS and `/MiramModular/buscador/buscador.jsp?g=1&...`. The Albareda excerpts retain reduced pagination anchors illustrating the real zero-indexed URLs: default/`p=0` versus distinct `p=1` records.

`miram-urania-unpublished.html` preserves the actual advance-preview card on `f=HU&p=1` titled “Què hi pintem, les dones? Una nova mirada a la història de l'art”. It has no edition ID/date and explicitly announces future registration; it is excluded, not assigned a fabricated identity. It is a parser-regression fixture, not an imported edition.

Browser fixtures change dates to 2099 only inside isolated E2E state. Real browsing data was loaded from separately verified source snapshots, never these test fixtures.
