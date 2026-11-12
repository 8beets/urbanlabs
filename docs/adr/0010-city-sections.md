# ADR 0010: One site section per city

Status: accepted

## Context

UrbanLabs lists Barcelona and Zaragoza (about 3,000 live editions) and is meant to grow
to 10–20 cities. The browser search downloads one index of every live edition; with
two cities it was 145 KB gzipped against the 150 KB budget of ADR 0008, and Madrid
alone (about 6,300 groups) would exceed it. Category pages and the centre directory
also listed every city on one page, so they grow without bound.

People look for courses where they live; searching several cities at once has little
value.

## Decision

- **Every course and centre page belongs to a city**, under `/<locale>/<city>/`:
  - `/es/zaragoza` — the city page: links to its search and centres, and its topics.
  - `/es/zaragoza/cursos` — the city's search (`/ca/zaragoza/cursos`).
  - `/es/zaragoza/cursos/<topic>` — paginated topic pages (the no-JavaScript route).
  - `/es/zaragoza/centros` and `/es/zaragoza/centros/<slug>` — the directory and centre
    pages (`/ca/zaragoza/centres/…`).

  The city segment is the city id, the same in every locale; pages show the localised
  name (Zaragoza/Saragossa). City ids must not collide with the fixed sections
  (`cursos`, `centros`, `centres`, `alertas`, `alertes`); a test checks this.

- **`/es/cursos` and `/es/centros` list the cities** that have centres. The primary
  navigation's "Cursos" and "Centros" items open a native disclosure listing the same
  cities, so they work by keyboard, with screen readers and without JavaScript.
- **One search index per city**: `/search/<city>/live.json` and `archive.json`. The
  build budget applies to each city's live index. The search form no longer has region
  and city filters; the city comes from the path.
- **Cards carry their centre's city** (`city_id`, stored once per centre in the index)
  so the centre and topic links point into the right city from any page.
- **No redirects** from the previous URLs (`/es/buscar`, `/es/centros/<slug>`), as
  decided with the maintainer; they fall through to the 404 page, which links to the
  city lists. Every alert subscription has a city (migration `0014`), optionally narrowed to a
  topic, and its emails link to that city's search.
- Ingestion, the database and the snapshot do not change.

## Consequences

- Adding a city adds pages and one more index file; no page or file covers every
  city, so the per-file budget holds as cities are added. The static file count still
  grows with editions (Workers Free allows 20,000 files); the build check reports it.
- Searching several cities at once is no longer possible.
- Old shared links and bookmarks break once.
