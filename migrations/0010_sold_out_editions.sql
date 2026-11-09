-- 1 only when the source explicitly says places are exhausted; 0 means no such notice,
-- not confirmed availability.
ALTER TABLE course_editions ADD COLUMN is_sold_out INTEGER NOT NULL DEFAULT 0
CHECK (is_sold_out IN (0, 1));
