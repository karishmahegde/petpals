-- Volunteer onboarding (the same wizard staff and vets complete before
-- approval) starts with this release, and approving a volunteer now
-- requires it. Every volunteer who was already approved before it was
-- created without onboarding, so mark them as already onboarded — otherwise
-- the frontend's onboarding gate would push existing volunteers into the
-- wizard on their next login. Banned and Deactivated volunteers are included
-- so a later reactivation doesn't land them in the wizard either; Pending
-- volunteers are left alone, since they still have to onboard before staff
-- can approve them. Data-only: onboardingComplete keeps its FALSE default,
-- so new sign-ups still go through onboarding.
UPDATE "Volunteer"
SET "onboardingComplete" = TRUE,
    "onboardingStep" = 5
WHERE "accountStatus" IS DISTINCT FROM 'Pending';
