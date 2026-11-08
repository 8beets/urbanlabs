-- Accent- and case-insensitive title search. The unicode61 tokenizer folds case and
-- strips diacritics for the whole Unicode range (composed and decomposed forms);
-- SQLite's NOCASE and lower() only fold ASCII. The index holds the title users see
-- (reviewed title first), while courses keeps the original accented text.
CREATE VIRTUAL TABLE courses_fts USING fts5(
  course_id UNINDEXED,
  title,
  tokenize = 'unicode61 remove_diacritics 2'
);

INSERT INTO courses_fts(course_id, title)
SELECT id, coalesce(reviewed_title, title) FROM courses;

CREATE TRIGGER courses_fts_insert AFTER INSERT ON courses BEGIN
  INSERT INTO courses_fts(course_id, title)
  VALUES (new.id, coalesce(new.reviewed_title, new.title));
END;

-- Ingestion upserts every course on each run; only re-index when the text changed.
CREATE TRIGGER courses_fts_update AFTER UPDATE OF title, reviewed_title ON courses
WHEN old.title IS NOT new.title OR old.reviewed_title IS NOT new.reviewed_title BEGIN
  DELETE FROM courses_fts WHERE course_id = old.id;
  INSERT INTO courses_fts(course_id, title)
  VALUES (new.id, coalesce(new.reviewed_title, new.title));
END;

CREATE TRIGGER courses_fts_delete AFTER DELETE ON courses BEGIN
  DELETE FROM courses_fts WHERE course_id = old.id;
END;
