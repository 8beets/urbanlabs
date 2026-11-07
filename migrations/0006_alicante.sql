-- Reference locations only. No courses or institution assignments are inferred.
INSERT INTO regions(id,country_code,name)
VALUES ('comunitat-valenciana','ES','Comunitat Valenciana');

INSERT INTO cities(id,country_code,region_id,name)
VALUES ('alicante','ES','comunitat-valenciana','Alicante');
