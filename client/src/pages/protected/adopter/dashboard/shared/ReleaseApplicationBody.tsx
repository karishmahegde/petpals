// ReleaseApplicationBody.tsx
// Confirm-modal copy for ending an application — Withdraw (under
// consideration) or Surrender (approved). Shared by the row action
// (ApplicationsList) and the detail slide-over's footer button.
import type { ReleaseAction } from "../../../../../logic/adopter/applicationStatus";

interface ReleaseApplicationBodyProps {
  action: ReleaseAction;
  petName: string;
  shelterName: string;
}

const ReleaseApplicationBody = ({
  action,
  petName,
  shelterName,
}: ReleaseApplicationBodyProps) =>
  action === "surrender" ? (
    <>
      This gives <strong>{petName}</strong> back to {shelterName}, who'll take
      them in again as an incoming pet. The $15 processing fee isn't refunded,
      and to adopt {petName} again you'd need a new application.
    </>
  ) : (
    <>
      This withdraws your application for <strong>{petName}</strong> at{" "}
      {shelterName}. The $15 processing fee isn't refunded, and you'd need to
      re-apply if you change your mind.
    </>
  );

export default ReleaseApplicationBody;
