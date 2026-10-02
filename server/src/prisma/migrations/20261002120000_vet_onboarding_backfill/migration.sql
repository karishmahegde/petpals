-- Vet onboarding (the same wizard staff complete before approval) starts
-- with this release, and approving a vet now requires it. Every vet who was
-- already approved before it was created without onboarding, so mark them
-- as already onboarded — otherwise the frontend's onboarding gate would push
-- existing vets into the wizard on their next login. Deactivated vets are
-- included so an Admin reactivation doesn't land them in the wizard either;
-- Pending vets are left alone, since they still have to onboard before a
-- manager can approve them. Data-only: onboardingComplete keeps its FALSE
-- default, so new sign-ups still go through onboarding.
UPDATE "Veterinarian"
SET "onboardingComplete" = TRUE,
    "onboardingStep" = 5
WHERE "accountStatus" IS DISTINCT FROM 'Pending';
