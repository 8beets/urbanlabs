-- Email alerts for new courses (issue #80). Personal data: rows are deleted on
-- unsubscribe, and unconfirmed rows are purged by the alerts job after 7 days.
-- Confirmation and unsubscribe links are HMAC-signed from the row id, so no token is stored.
CREATE TABLE alert_subscriptions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  locale TEXT NOT NULL CHECK (locale IN ('es', 'ca')),
  category TEXT CHECK (category IS NULL OR category <> ''),
  country_code TEXT,
  city_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed')),
  created_at TEXT NOT NULL,
  confirmation_sent_at TEXT,
  confirmed_at TEXT,
  -- Set to confirmed_at on confirmation, so "due" is one indexed comparison.
  last_digest_at TEXT,
  CHECK (category IS NOT NULL OR city_id IS NOT NULL),
  CHECK ((country_code IS NULL) = (city_id IS NULL)),
  CHECK (status = 'pending' OR (confirmed_at IS NOT NULL AND last_digest_at IS NOT NULL)),
  FOREIGN KEY (country_code, city_id) REFERENCES cities(country_code, id)
);
CREATE UNIQUE INDEX alert_subscriptions_target
ON alert_subscriptions(email, ifnull(category, ''), ifnull(city_id, ''));
CREATE INDEX alert_subscriptions_due ON alert_subscriptions(status, last_digest_at);
CREATE INDEX alert_subscriptions_pending ON alert_subscriptions(status, created_at);
