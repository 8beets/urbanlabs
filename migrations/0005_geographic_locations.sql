CREATE TABLE countries (
  code TEXT PRIMARY KEY CHECK (length(code)=2 AND code NOT GLOB '*[^A-Z]*'),
  name TEXT NOT NULL
);
CREATE TABLE regions (
  id TEXT PRIMARY KEY,
  country_code TEXT NOT NULL REFERENCES countries(code),
  name TEXT NOT NULL,
  UNIQUE(country_code, id)
);
CREATE TABLE cities (
  id TEXT PRIMARY KEY,
  country_code TEXT NOT NULL,
  region_id TEXT NOT NULL,
  name TEXT NOT NULL,
  FOREIGN KEY(country_code, region_id) REFERENCES regions(country_code, id),
  UNIQUE(country_code, id)
);
CREATE TABLE institution_locations (
  institution_id TEXT PRIMARY KEY REFERENCES institutions(id),
  country_code TEXT NOT NULL,
  city_id TEXT NOT NULL,
  FOREIGN KEY(country_code, city_id) REFERENCES cities(country_code, id)
);
CREATE INDEX regions_country ON regions(country_code, name, id);
CREATE INDEX cities_region ON cities(region_id, name, id);
CREATE INDEX locations_country_city ON institution_locations(country_code, city_id, institution_id);
CREATE INDEX locations_city ON institution_locations(city_id, institution_id);
INSERT INTO countries(code,name) VALUES ('ES','España');
INSERT INTO regions(id,country_code,name) VALUES ('catalunya','ES','Catalunya');
INSERT INTO cities(id,country_code,region_id,name) VALUES
  ('barcelona','ES','catalunya','Barcelona'),
  ('tarragona','ES','catalunya','Tarragona');

-- Reviewed institution IDs, never inferred from names or free-form addresses.
INSERT INTO institution_locations(institution_id,country_code,city_id)
SELECT id,'ES','barcelona' FROM institutions WHERE id IN (
  'cc-sant-andreu','cc-can-baste','cc-pati-llimona','cc-golferichs',
  'cc-casa-elizalde','cc-albareda','cc-el-sortidor','cc-vil-la-urania','cc-urgell',
  'fab-casa-del-rellotge','fab-casa-del-mig'
);
