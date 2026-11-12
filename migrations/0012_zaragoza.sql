-- Reference locations only. Centres are assigned when their reviewed sources are ingested.
INSERT INTO regions(id,country_code,name) VALUES ('aragon','ES','Aragón');

INSERT INTO cities(id,country_code,region_id,name)
VALUES ('zaragoza','ES','aragon','Zaragoza');
