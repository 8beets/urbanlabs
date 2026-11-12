-- Name of the association or entity that runs the course when the source names one
-- other than the centre (e.g. Zaragoza civic centres). Unknown is NULL.
ALTER TABLE course_editions ADD COLUMN organizer TEXT
CHECK (organizer IS NULL OR length(organizer) BETWEEN 1 AND 200);
