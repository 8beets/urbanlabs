-- Expired editions stay stored for provenance, but discovery only lists live ones.
-- `end_date IS NULL OR end_date >= ?` cannot use an index, so every listing, category
-- and centre query walked all editions ever imported. A virtual generated column maps
-- an unknown end date to a far-future sentinel (unknown means "not known to have
-- ended", as before), and the index turns liveness into one bounded range scan.
ALTER TABLE course_editions ADD COLUMN live_until TEXT
GENERATED ALWAYS AS (coalesce(end_date, '9999-12-31')) VIRTUAL;

CREATE INDEX editions_live_until ON course_editions(live_until);
