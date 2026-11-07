-- False means no explicit cancellation has been recorded, not confirmed availability.
ALTER TABLE course_editions ADD COLUMN is_cancelled INTEGER NOT NULL DEFAULT 0
CHECK (is_cancelled IN (0, 1));
