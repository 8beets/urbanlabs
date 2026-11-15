# Open course data (hand-maintained)

Some programmes have no feed UrbanLabs can read: they are PDFs, or their sites block automated access. Their courses can be added by hand to the public repository [8beets/urban-open-courses-data](https://github.com/8beets/urban-open-courses-data). UrbanLabs imports them like any other source (platform `open-courses-data`).

## Layout

One folder per city, with the IDs of `data/geography.json`:

```text
<country>/<region>/<city>/
  centres.csv   the centres of that city
  courses.csv   their courses
```

For example `es/catalunya/barcelona/`. A new city must first exist in `data/geography.json`.

Both files are UTF-8 CSV with a header row and commas. Quote a value that contains a comma, a quote or a line break (`"Lunes, 18:00"`); write a quote inside a quoted value as `""`. Values are trimmed. Column order does not matter, and extra columns (for your own notes) are ignored.

## centres.csv

| Column         | Required | Format                                                               |
| -------------- | -------- | -------------------------------------------------------------------- |
| `id`           | yes      | lower-case letters, digits and `-`; unique in the file, never reused |
| `name`         | yes      | the centre's official name                                           |
| `address`      | yes      | street, number, postcode and town                                    |
| `official_url` | yes      | `https://` page of the centre or its programme                       |
| `latitude`     | yes      | decimal degrees, at least 4 decimals, e.g. `41.3851`                 |
| `longitude`    | yes      | decimal degrees, at least 4 decimals, e.g. `2.1734`                  |
| `phone`        | no       | digits, spaces, `+`, `(`, `)`, `-`                                   |
| `email`        | no       | the centre's public address; never a person's own                    |

## courses.csv

One row per course edition (a scheduled run of a course).

| Column         | Required | Format                                                                                       |
| -------------- | -------- | -------------------------------------------------------------------------------------------- |
| `centre_id`    | yes      | an `id` from the same folder's centres.csv                                                   |
| `course_id`    | yes      | letters, digits and `._~:-`; unique per centre and **stable**: the same edition keeps its id |
| `title`        | yes      | as published, in its original language                                                       |
| `official_url` | yes      | `https://` page where the course is published or people register                             |
| `category`     | no       | the source's own category, e.g. `Idiomas`                                                    |
| `start_date`   | no       | `YYYY-MM-DD`                                                                                 |
| `end_date`     | no       | `YYYY-MM-DD`, not before `start_date`                                                        |
| `schedule`     | no       | as published, e.g. `Lunes y miércoles, 18:00–19:30`                                          |
| `price_eur`    | no       | the full price as a number, e.g. `45.50`; `0` only when it is explicitly free                |
| `status`       | no       | empty, `cancelled` or `sold-out`                                                             |

Leave a value empty when it is not published: never guess dates, prices or availability. Do not add descriptions, teacher names or other personal data.

## How it is imported

- **Centres** are reviewed into the registry like any other (ADR 0004). `npm run open-data:centres -- es/catalunya/barcelona` reads that folder's centres.csv and prints draft records; check them and add them to `data/centres/es/barcelona.json`. Use `--file path/to/centres.csv` to try a local file first. Drafts carry `mayBeEmpty`, because a centre can be listed before its courses, and their map point and contact details link back to centres.csv.
- **Courses** are read on every ingestion run from `https://raw.githubusercontent.com/8beets/urban-open-courses-data/main/<folder>/courses.csv`, once per city and shared by its centres. Each centre keeps the rows with its `centre_id`.
- **Validation.** Every row of a city's courses.csv is checked. One bad value fails the whole city's run with the row and column named, and the courses already imported stay as they were. A centre with no rows yet, or a folder without courses.csv, is a successful empty run.
- **Identity.** `course_id` is the external id: changing it creates a new edition, and a row removed from the file is kept as before (removed records are never deleted on one run).
- **Access.** raw.githubusercontent.com has no robots.txt today; the adapter checks for one on every run and stops if it disallows the file.

The code is in `src/lib/ingestion/adapters/open-courses-data.ts` (courses) and `src/lib/centres/open-data.ts` (centres); the tests use synthetic fixtures in `tests/fixtures/open-courses-data/`.
