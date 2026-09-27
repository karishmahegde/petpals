-- A pet can only be adopted/fostered by one applicant at a time: at most one
-- Accepted application per pet. adoptionApplications.service.js already
-- refuses to accept an application for a pet that's no longer available
-- (and declines the pet's other Pending applications when one is accepted),
-- but two staff accepting different applications for the same pet at the
-- same moment could both pass that check — this index makes the second one
-- fail, and the service maps that to the same 409.
-- Withdrawing an Accepted application (Accepted → Withdrawn) frees the pet
-- again, so a later acceptance is still possible.
CREATE UNIQUE INDEX "AdoptionApplication_one_accepted_per_pet_key"
  ON "AdoptionApplication" ("petID")
  WHERE "applicationStatus" = 'Accepted';
