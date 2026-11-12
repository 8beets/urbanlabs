-- Every alert belongs to a city, like every search (docs/adr/0010-city-sections.md).
-- SQLite cannot add NOT NULL to a column, so the table is rebuilt. Subscriptions without
-- a city cannot be served any more and are not copied (deleting them is what
-- unsubscribing does too); alerts were not yet enabled in production when this ran.
CREATE TABLE alert_subscriptions_new (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  locale TEXT NOT NULL CHECK (locale IN ('es', 'ca')),
  category TEXT CHECK (category IS NULL OR category <> ''),
  country_code TEXT NOT NULL,
  city_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed')),
  created_at TEXT NOT NULL,
  confirmation_sent_at TEXT,
  confirmed_at TEXT,
  last_digest_at TEXT,
  CHECK (status = 'pending' OR (confirmed_at IS NOT NULL AND last_digest_at IS NOT NULL)),
  FOREIGN KEY (country_code, city_id) REFERENCES cities(country_code, id)
);
INSERT INTO alert_subscriptions_new
SELECT id, email, locale, category, country_code, city_id, status, created_at,
  confirmation_sent_at, confirmed_at, last_digest_at
FROM alert_subscriptions WHERE city_id IS NOT NULL;
DROP TABLE alert_subscriptions;
ALTER TABLE alert_subscriptions_new RENAME TO alert_subscriptions;
CREATE UNIQUE INDEX alert_subscriptions_target
ON alert_subscriptions(email, ifnull(category, ''), city_id);
CREATE INDEX alert_subscriptions_due ON alert_subscriptions(status, last_digest_at);
CREATE INDEX alert_subscriptions_pending ON alert_subscriptions(status, created_at);
