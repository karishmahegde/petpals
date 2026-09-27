-- Staff onboarding (a wizard new staff complete before approval) starts with
-- this release. Every staff row that exists before it was created without
-- onboarding, so mark them all as already onboarded — otherwise the
-- frontend's onboarding gate would push existing staff into the wizard on
-- their next login. Data-only: onboardingComplete keeps its FALSE default,
-- so new sign-ups still go through onboarding.
UPDATE "Staff"
SET "onboardingComplete" = TRUE,
    "onboardingStep" = 5;
