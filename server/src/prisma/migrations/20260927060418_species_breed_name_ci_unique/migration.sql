-- Case-insensitive uniqueness for species and breed names, so "Labrador" and
-- "labrador" can't both exist. staff/species.service.js already checks this
-- before inserting (for a clean 409), but two concurrent requests can both
-- pass that check; these indexes make the second insert fail, and the
-- service maps that unique violation to the same 409.
--
-- Expression indexes aren't expressible in schema.prisma (see the comments
-- on the Species and Breed models), so they live only here.

-- Species names are unique across the whole table.
CREATE UNIQUE INDEX "Species_speciesName_lower_key"
  ON "Species" (LOWER("speciesName"));

-- Breed names are unique within their species ("Mixed" can exist for both
-- Dog and Cat).
CREATE UNIQUE INDEX "Breed_speciesID_breedName_lower_key"
  ON "Breed" ("speciesID", LOWER("breedName"));
