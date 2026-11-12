# ADR 0009: Fixed course topics from reviewed tables

Status: accepted (issue #95)

## Context

The 46 imported centres label their courses with 239 different categories (production
search index, November 2026). Many are spelling variants of one idea (`IDIOMES`,
`Idiomes`, `LLENGÜES`, `4- LLENGÜES`); others mix subjects (`EXPRESSIÓ` holds yoga,
dance and theatre), name an audience (`FAMILIARS`, `GENT GRAN`) or a format or
programme (`CÀPSULES`, `#FEMBARRI`). The category filter listed dozens of overlapping
choices.

Model-based classification was considered. The suggested on-device tool runs only on
macOS with Apple-silicon GPUs, and production ingestion must not depend on LLMs
(`AGENTS.md`). Offline model help for reviewers is tracked separately.

## Decision

- Every course is listed under exactly one of 13 fixed topics with stable ids, which
  are also the URL values and category page slugs.
- `src/lib/courses/categories.ts` holds a reviewed table from source category to
  topic. Categories that mix subjects or name an audience, format or programme are
  listed as mixed; their courses are classified by ordered title keyword rules. A
  course no rule matches is listed under "Altres" rather than guessed.
- A few reviewed categories name a topic but also hold courses of another (Zaragoza's
  "Música" and "Deporte" include dance classes). For those, a title rule for one of the
  listed other topics wins; otherwise the category's topic stands.
- An optional audience (families, children and young people, older people, women) comes
  from a second reviewed table of audience categories, then conservative title rules.
  It is a separate filter.
- Classification runs at build time and in the browser over the stored source
  category and title. D1 and ingestion are unchanged, so a table change needs only a
  rebuild.
- `?category=` accepts only topic ids. Links and alert subscriptions that use former
  category values are not kept working; such links show the invalid-filter error.
- The weekly freshness report lists source categories missing from the tables, so a
  new centre's categories get reviewed.

## Consequences

- On the November 2026 production data, about 98% of editions get a specific topic;
  about 2% (games, events, programme names with vague titles) are listed under
  "Altres".
- Title rules can misclassify; corrections are a reviewed edit to the rules, covered
  by unit tests built from real titles.
- Former category page URLs whose slug is not a topic id (for example
  `/categoria/fotografia`) return 404, and alert subscriptions stored with a former
  category value no longer match any course.
