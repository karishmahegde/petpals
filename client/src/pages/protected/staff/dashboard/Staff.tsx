import { useState } from "react";
import { Navigate } from "react-router-dom";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import toast from "react-hot-toast";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardWidgetHeader from "../../../../components/ui/dashboard/DashboardWidgetHeader";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import PaginationControls from "../../../../components/ui/dashboard/PaginationControls";
import Avatar from "../../../../components/ui/Avatar";
import Card from "../../../../components/ui/Card";
import SelectField from "../../../../components/ui/SelectField";
import PhoneDisplay from "../../../../components/ui/PhoneDisplay";
import {
  DashboardActionList,
  DashboardListRow,
  RowActionButton,
} from "../../../../components/ui/dashboard/DashboardList";
import {
  getMyStaffProfile,
  type StaffDesignation,
} from "../../../../logic/api/staffApi";
import {
  getShelterStaffMembers,
  updateShelterStaffStatus,
  type AssignableDesignation,
  type ShelterStaffMember,
} from "../../../../logic/api/shelterStaffApi";
import ConfirmActionModal from "../../../../components/ui/ConfirmActionModal";
import StaffDetailPanel from "./sections/staff/StaffDetailPanel";

const PAGE_SIZE = 20;

type DesignationFilter = StaffDesignation | "all";

const DESIGNATION_OPTIONS: { value: DesignationFilter; label: string }[] = [
  { value: "all", label: "All Designations" },
  { value: "Manager", label: "Manager" },
  { value: "Senior", label: "Senior" },
  { value: "Associate", label: "Associate" },
];

// Matches SelectField's own label + trigger sizing, same as Transfers.tsx.
const filterInputClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark";
const filterLabelClass =
  "mb-1.5 block font-body text-sm font-semibold text-neutral-charcoal";

// Shared by both sections' rows: avatar | name + designation | phone and
// email inline | actions.
const memberRowProps = (member: ShelterStaffMember) => ({
  leading: (
    <Avatar
      seed={member.avatarSeed}
      alt={`${member.staffName} avatar`}
      size={48}
      className="h-12 w-12 shrink-0 rounded-full ring-2 ring-teal-dark"
    />
  ),
  title: member.staffName,
  lines: [{ text: member.staffDesignation ?? "No designation" }],
  details: (
    <>
      <span className="flex items-center gap-2">
        <span role="img" aria-label="Phone" className="shrink-0">
          ☎️
        </span>
        {member.staffPhone ? (
          <PhoneDisplay value={member.staffPhone} />
        ) : (
          "No phone"
        )}
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <span role="img" aria-label="Email" className="shrink-0">
          ✉️
        </span>
        <span className="truncate">{member.staffEmail}</span>
      </span>
    </>
  ),
});

// Staff tab (Management → Staff) — the shelter manager's roster: All Staff
// (approved: Active or Deactivated, with designation filter + name search;
// "View Details" opens StaffDetailPanel, which also lets the manager change
// another Active member's designation or deactivate them) and Staff Approvals
// (Pending registrations at this shelter; Approve opens a dialog to pick
// their designation — staff sign up without one — Decline behind a
// confirm — same pattern as the Volunteers tab). Manager-only: everyone
// else is sent to /forbidden, and GET/PATCH /staff/me/team 403 them too.
const Staff = () => {
  const queryClient = useQueryClient();
  const [viewing, setViewing] = useState<ShelterStaffMember | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["staff", "me"],
    queryFn: getMyStaffProfile,
  });
  const isManager = profile?.staffDesignation === "Manager";

  const [page, setPage] = useState(1);
  const [designation, setDesignation] = useState<DesignationFilter>("all");
  const [name, setName] = useState("");

  const allQuery = useQuery({
    queryKey: ["staff", "staff-members", "all", { page, designation, name }],
    queryFn: () =>
      getShelterStaffMembers({
        section: "all",
        staffDesignation: designation === "all" ? undefined : designation,
        name: name.trim() || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    enabled: isManager,
    placeholderData: keepPreviousData,
  });
  const members = allQuery.data?.data ?? [];

  const pendingQuery = useQuery({
    queryKey: ["staff", "staff-members", "pending"],
    queryFn: () => getShelterStaffMembers({ section: "pending", limit: 100 }),
    enabled: isManager,
  });
  const pendingMembers = pendingQuery.data?.data ?? [];

  // The Pending member being approved, and the designation picked for them.
  const [approving, setApproving] = useState<ShelterStaffMember | null>(null);
  const [newDesignation, setNewDesignation] = useState<
    AssignableDesignation | ""
  >("");

  const closeApprove = () => {
    setApproving(null);
    setNewDesignation("");
  };

  const approve = useMutation({
    mutationFn: ({
      userID,
      staffDesignation,
    }: {
      userID: number;
      staffDesignation: AssignableDesignation;
    }) => updateShelterStaffStatus(userID, "Active", staffDesignation),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "staff-members"] });
      toast.success("Staff member approved");
      closeApprove();
    },
    onError: () =>
      toast.error("Couldn't approve this staff member. Please try again."),
  });

  if (profile && !isManager) {
    return <Navigate to="/forbidden" replace />;
  }

  return (
    <div>
      <DashboardHeading
        title="Staff"
        emoji="👩‍💼"
        message="Manage your shelter staff"
      />

      <Card className="mb-6 p-6">
        <DashboardWidgetHeader
          icon="🧑‍💼"
          title="Staff Approvals"
          className="mb-4"
        />

        {pendingQuery.isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {pendingQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load pending staff. Please try again.
          </p>
        )}
        {pendingQuery.data && pendingMembers.length === 0 && (
          <DashboardEmptyMessage>
            No staff awaiting approval.
          </DashboardEmptyMessage>
        )}

        {pendingMembers.length > 0 && (
          <DashboardActionList
            items={pendingMembers}
            getKey={(member) => member.userID}
            renderRow={(member, confirm) => (
              <DashboardListRow
                {...memberRowProps(member)}
                actions={
                  <>
                    <RowActionButton
                      variant="success"
                      onClick={() => setApproving(member)}
                    >
                      Approve
                    </RowActionButton>
                    <RowActionButton
                      variant="danger"
                      onClick={() => confirm(member)}
                    >
                      Decline
                    </RowActionButton>
                  </>
                }
              />
            )}
            confirmAction={{
              mutationFn: (member) =>
                updateShelterStaffStatus(member.userID, "Deactivated"),
              invalidateKeys: [["staff", "staff-members"]],
              successToast: "Staff member declined",
              errorToast:
                "Couldn't decline this staff member. Please try again.",
              modalTitle: "Decline this staff member?",
              confirmLabel: "Decline",
              renderBody: (member) => (
                <>
                  This declines {member.staffName}'s registration and
                  deactivates their account.
                </>
              ),
            }}
          />
        )}
      </Card>

      <Card className="p-6">
        <DashboardWidgetHeader icon="🧑‍💼" title="All Staff" className="mb-4" />

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Designation"
            value={designation}
            onChange={(v) => {
              setDesignation(v as DesignationFilter);
              setPage(1);
            }}
            options={DESIGNATION_OPTIONS}
          />
          <div>
            <label className={filterLabelClass} htmlFor="staff-name-search">
              Staff Name
            </label>
            <input
              id="staff-name-search"
              placeholder="Search by staff name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setPage(1);
              }}
              className={filterInputClass}
            />
          </div>
        </div>

        {(allQuery.isLoading || !profile) && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {allQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load staff. Please try again.
          </p>
        )}
        {allQuery.data && members.length === 0 && (
          <DashboardEmptyMessage>
            No staff match your filters.
          </DashboardEmptyMessage>
        )}

        {members.length > 0 && (
          <ul className="flex flex-col gap-4">
            {members.map((member) => (
              <li key={member.userID}>
                <DashboardListRow
                  {...memberRowProps(member)}
                  badge={
                    member.accountStatus === "Deactivated"
                      ? { label: "Deactivated", tone: "gray" }
                      : undefined
                  }
                  actions={
                    <RowActionButton onClick={() => setViewing(member)}>
                      View Details
                    </RowActionButton>
                  }
                />
              </li>
            ))}
          </ul>
        )}

        <PaginationControls
          page={page}
          totalPages={allQuery.data?.pagination.totalPages ?? 1}
          onChange={setPage}
        />
      </Card>

      <ConfirmActionModal
        isOpen={approving !== null}
        title="Approve this staff member?"
        confirmLabel="Approve"
        cancelLabel="Cancel"
        isPending={approve.isPending}
        onCancel={closeApprove}
        onConfirm={() => {
          if (!approving) return;
          if (!newDesignation) {
            toast.error("Pick a designation to approve them");
            return;
          }
          approve.mutate({
            userID: approving.userID,
            staffDesignation: newDesignation,
          });
        }}
      >
        {approving && (
          <div className="flex flex-col gap-3">
            <p>
              This activates {approving.staffName}'s account at your shelter.
              Choose their designation.
            </p>
            <div>
              <label
                htmlFor="approve-designation"
                className="font-body text-xs text-neutral-gray"
              >
                Designation
              </label>
              <select
                id="approve-designation"
                value={newDesignation}
                disabled={approve.isPending}
                onChange={(e) =>
                  setNewDesignation(e.target.value as AssignableDesignation)
                }
                className={`mt-1 ${filterInputClass}`}
              >
                <option value="" disabled>
                  - Select -
                </option>
                <option value="Senior">Senior</option>
                <option value="Associate">Associate</option>
              </select>
            </div>
          </div>
        )}
      </ConfirmActionModal>

      {/* key remounts the panel per member so it seeds that member's designation. */}
      <StaffDetailPanel
        key={viewing?.userID ?? "none"}
        member={viewing}
        // Not on yourself (nothing a manager can change about their own
        // role here) or on deactivated staff.
        canManage={
          viewing !== null &&
          viewing.userID !== profile?.userID &&
          viewing.accountStatus === "Active"
        }
        onClose={() => setViewing(null)}
      />
    </div>
  );
};

export default Staff;
