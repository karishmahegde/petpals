// AwaitingApproval.tsx
// Route element for /staff/pending and /vet/pending (ProtectedRoute +
// RoleRoute for that role). Where a new staff member or vet waits after
// finishing onboarding, until they're approved — OnboardingGate sends every
// other route here while their account is still Pending. Shows what
// approval is waiting on (their ID's verification, then the approver's
// decision) and re-checks their account in the background: once approved,
// it moves straight to their dashboard. A declined sign-up is Deactivated,
// so the next check 401s and the axios interceptor logs them out.
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
import Navbar from "../../../components/layout/Navbar";
import Card from "../../../components/ui/Card";
import GovernmentIdSection from "./GovernmentIdSection";
import {
  getMyStaffProfile,
  staffGovernmentIdApi,
  type StaffSelfProfile,
} from "../../../logic/api/staffApi";
import {
  getMyVetProfile,
  vetGovernmentIdApi,
  type VetSelfProfile,
} from "../../../logic/api/vetsApi";
import type { SelfGovernmentIdApi } from "../../../logic/api/selfGovernmentIdApi";
import useAuthStore from "../../../logic/store/useAuthStore";

// How often to re-check for approval while this page is open (it also
// re-checks whenever the window regains focus).
const RECHECK_MS = 30_000;

type PendingRole = "Staff" | "Veterinarian";

// What this page needs from either role's profile.
interface PendingSummary {
  accountStatus: string | null;
  firstName: string;
  shelterName: string | null;
  approver: string;
}

// Per-role wiring. The profile query reuses each role's own cache key, so
// it shares data with the rest of that role's screens.
const ROLE_CONFIG: Record<
  PendingRole,
  {
    profileKey: readonly unknown[];
    fetchProfile: () => Promise<unknown>;
    summarize: (profile: unknown) => PendingSummary;
    dashboardPath: string;
    welcome: string;
    governmentIdApi: SelfGovernmentIdApi;
  }
> = {
  Staff: {
    profileKey: ["staff", "me"],
    fetchProfile: getMyStaffProfile,
    summarize: (profile) => {
      const staff = profile as StaffSelfProfile;
      return {
        accountStatus: staff.accountStatus,
        firstName: staff.staffName.split(" ")[0],
        shelterName: staff.shelter?.shelterName ?? null,
        // Manager sign-ups are approved by an Admin; everyone else by their
        // shelter's manager.
        approver:
          staff.staffDesignation === "Manager"
            ? "A PetPals administrator"
            : "Your shelter's manager",
      };
    },
    dashboardPath: "/staff",
    welcome: "You're approved — welcome to the team!",
    governmentIdApi: staffGovernmentIdApi,
  },
  Veterinarian: {
    profileKey: ["vet", "me"],
    fetchProfile: getMyVetProfile,
    summarize: (profile) => {
      const vet = profile as VetSelfProfile;
      return {
        accountStatus: vet.accountStatus,
        firstName: vet.vetName.split(" ")[0],
        shelterName: vet.shelter?.shelterName ?? null,
        approver: "Your shelter's manager",
      };
    },
    dashboardPath: "/vet",
    welcome: "You're approved — welcome to the team!",
    governmentIdApi: vetGovernmentIdApi,
  },
};

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

interface AwaitingApprovalProps {
  role: PendingRole;
}

const AwaitingApproval = ({ role }: AwaitingApprovalProps) => {
  const navigate = useNavigate();
  const updateUser = useAuthStore((state) => state.updateUser);
  const config = ROLE_CONFIG[role];

  const profileQuery = useQuery({
    queryKey: config.profileKey,
    queryFn: config.fetchProfile,
    refetchInterval: RECHECK_MS,
  });

  const idQuery = useQuery({
    queryKey: config.governmentIdApi.queryKey,
    queryFn: config.governmentIdApi.get,
    refetchInterval: RECHECK_MS,
    retry: (failureCount, err) =>
      axios.isAxiosError(err) && err.response?.status === 404
        ? false
        : failureCount < 2,
  });

  const summary = profileQuery.data
    ? config.summarize(profileQuery.data)
    : null;

  useEffect(() => {
    if (summary?.accountStatus === "Active") {
      updateUser({ accountStatus: "Active" });
      toast.success(config.welcome);
      navigate(config.dashboardPath, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary?.accountStatus]);

  const idStatus = idQuery.isSuccess ? idQuery.data.verificationStatus : null;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1 bg-neutral-offwhite px-4 py-10">
        <div className="mx-auto max-w-2xl">
          <Card className="p-6 md:p-8">
            {!summary ? (
              <p className="py-10 text-center font-body text-sm text-neutral-gray">
                Loading…
              </p>
            ) : (
              <>
                <h1 className="font-display text-2xl text-neutral-dark">
                  Your account is awaiting approval
                </h1>
                <p className="mt-2 font-body text-sm text-neutral-gray">
                  Thanks, {summary.firstName}! {summary.approver} at{" "}
                  <span className="font-bold text-neutral-dark">
                    {summary.shelterName ?? "your shelter"}
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
                    detail={`${summary.approver} approves your account once your ID is verified.`}
                  />
                </ul>

                {idStatus === "Rejected" && (
                  <div className="mt-6">
                    <GovernmentIdSection api={config.governmentIdApi} isEditing />
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
