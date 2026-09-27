// AwaitingApproval.tsx
// Route element for /staff/pending (ProtectedRoute + RoleRoute(["Staff"])).
// Where a new staff member waits after finishing onboarding, until they're
// approved — OnboardingGate sends every other route here while their
// account is still Pending. Shows what approval is waiting on (their ID's
// verification, then the approver's decision) and re-checks their account
// in the background: once approved, it moves straight to the dashboard.
// A declined sign-up is Deactivated, so the next check 401s and the axios
// interceptor logs them out.
import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import {
  PiCheckCircleFill,
  PiClockFill,
  PiXCircleFill,
} from "react-icons/pi";
import Navbar from "../../../../components/layout/Navbar";
import Card from "../../../../components/ui/Card";
import GovernmentIdSection from "../shared/GovernmentIdSection";
import {
  getMyStaffGovernmentId,
  getMyStaffProfile,
} from "../../../../logic/api/staffApi";
import useAuthStore from "../../../../logic/store/useAuthStore";

// How often to re-check for approval while this page is open (it also
// re-checks whenever the window regains focus).
const RECHECK_MS = 30_000;

type ItemState = "done" | "waiting" | "problem";

const ITEM_ICON: Record<ItemState, ReactNode> = {
  done: <PiCheckCircleFill className="h-6 w-6 shrink-0 text-green" aria-hidden />,
  waiting: <PiClockFill className="h-6 w-6 shrink-0 text-gold-dark" aria-hidden />,
  problem: <PiXCircleFill className="h-6 w-6 shrink-0 text-red" aria-hidden />,
};

const ChecklistItem = ({
  state,
  title,
  detail,
}: {
  state: ItemState;
  title: string;
  detail: string;
}) => (
  <li className="flex items-start gap-3">
    {ITEM_ICON[state]}
    <div>
      <p className="font-body text-sm font-bold text-neutral-dark">{title}</p>
      <p className="font-body text-sm text-neutral-gray">{detail}</p>
    </div>
  </li>
);

const AwaitingApproval = () => {
  const navigate = useNavigate();
  const updateUser = useAuthStore((state) => state.updateUser);

  const profileQuery = useQuery({
    queryKey: ["staff", "me"],
    queryFn: getMyStaffProfile,
    refetchInterval: RECHECK_MS,
  });

  const idQuery = useQuery({
    queryKey: ["staff", "government-id"],
    queryFn: getMyStaffGovernmentId,
    refetchInterval: RECHECK_MS,
    retry: (failureCount, err) =>
      axios.isAxiosError(err) && err.response?.status === 404
        ? false
        : failureCount < 2,
  });

  const profile = profileQuery.data;

  useEffect(() => {
    if (profile?.accountStatus === "Active") {
      updateUser({ accountStatus: "Active" });
      toast.success("You're approved — welcome to the team!");
      navigate("/staff", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.accountStatus]);

  const idStatus = idQuery.isSuccess ? idQuery.data.verificationStatus : null;
  const approver =
    profile?.staffDesignation === "Manager"
      ? "A PetPals administrator"
      : "Your shelter's manager";

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1 bg-neutral-offwhite px-4 py-10">
        <div className="mx-auto max-w-2xl">
          <Card className="p-6 md:p-8">
            {!profile ? (
              <p className="py-10 text-center font-body text-sm text-neutral-gray">
                Loading…
              </p>
            ) : (
              <>
                <h1 className="font-display text-2xl text-neutral-dark">
                  Your account is awaiting approval
                </h1>
                <p className="mt-2 font-body text-sm text-neutral-gray">
                  Thanks, {profile.staffName.split(" ")[0]}! {approver} at{" "}
                  <span className="font-bold text-neutral-dark">
                    {profile.shelter?.shelterName ?? "your shelter"}
                  </span>{" "}
                  will review your profile. This page updates on its own —
                  you'll go straight to your dashboard once you're approved.
                </p>

                <ul className="mt-6 flex flex-col gap-4">
                  <ChecklistItem
                    state="done"
                    title="Profile complete"
                    detail="Your personal details, address and ID are on file."
                  />
                  <ChecklistItem
                    state={
                      idStatus === "Verified"
                        ? "done"
                        : idStatus === "Rejected"
                          ? "problem"
                          : "waiting"
                    }
                    title="Government ID verified"
                    detail={
                      idStatus === "Verified"
                        ? "Your ID has been verified."
                        : idStatus === "Rejected"
                          ? "Your ID was rejected — please upload a new one below."
                          : "Submitted — waiting to be verified."
                    }
                  />
                  <ChecklistItem
                    state="waiting"
                    title="Account approved"
                    detail={`${approver} approves your account once your ID is verified.`}
                  />
                </ul>

                {idStatus === "Rejected" && (
                  <div className="mt-6">
                    <GovernmentIdSection isEditing />
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AwaitingApproval;
