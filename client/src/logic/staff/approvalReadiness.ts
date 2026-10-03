// Approving a Pending staff member or veterinarian needs BOTH onboarding
// complete and a Verified government ID — the server enforces it
// (services/staff/staffApproval.service.js, 409 otherwise); these helpers
// just describe it the same way on every screen that shows it (the
// Manager's Staff and Vets tabs, Admin's Staff Approval panel, and the
// staff member's own "awaiting approval" screen).
import type { GovernmentIdStatus } from "../api/staffApi";

interface ApprovalFacts {
  onboardingComplete: boolean;
  governmentIdStatus: GovernmentIdStatus | null;
}

// What's still in the way, in plain words — empty when ready to approve.
export const approvalBlockers = ({
  onboardingComplete,
  governmentIdStatus,
}: ApprovalFacts): string[] => {
  const blockers: string[] = [];
  if (!onboardingComplete) blockers.push("Onboarding not finished");
  if (governmentIdStatus === null) blockers.push("Government ID not submitted");
  else if (governmentIdStatus === "Pending") blockers.push("Government ID awaiting verification");
  else if (governmentIdStatus === "Rejected") blockers.push("Government ID was rejected");
  return blockers;
};

export const isReadyForApproval = (facts: ApprovalFacts): boolean =>
  approvalBlockers(facts).length === 0;
