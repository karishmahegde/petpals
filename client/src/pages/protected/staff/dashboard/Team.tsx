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
import Card from "../../../../components/ui/Card";
import SelectField from "../../../../components/ui/SelectField";
import PhoneDisplay from "../../../../components/ui/PhoneDisplay";
import {
  DashboardActionList,
  DashboardListRow,
  RowActionButton,
  type RowLine,
} from "../../../../components/ui/dashboard/DashboardList";
import { getMyStaffProfile, type StaffDesignation } from "../../../../logic/api/staffApi";
import { getTeam, updateTeamStatus, type TeamMember } from "../../../../logic/api/teamApi";
import StaffEditPanel from "./sections/team/StaffEditPanel";

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

const memberLines = (member: TeamMember): RowLine[] => [
  { text: member.staffDesignation ?? "No designation" },
  {
    text: member.staffPhone ? <PhoneDisplay value={member.staffPhone} /> : "No phone",
  },
  { text: member.staffEmail },
];

// Staff tab (Management → Staff) — the shelter manager's roster: All Staff
// (approved: Active or Deactivated, with designation filter + name search;
// "Edit" on other Active staff opens StaffEditPanel) and Staff Approvals
// (Pending registrations at this shelter; Approve inline, Decline behind a
// confirm — same pattern as the Volunteers tab). Manager-only: everyone
// else is sent to /forbidden, and GET/PATCH /staff/me/team 403 them too.
const Team = () => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<TeamMember | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["staff", "me"],
    queryFn: getMyStaffProfile,
  });
  const isManager = profile?.staffDesignation === "Manager";

  const [page, setPage] = useState(1);
  const [designation, setDesignation] = useState<DesignationFilter>("all");
  const [name, setName] = useState("");

  const allQuery = useQuery({
    queryKey: ["staff", "team", "all", { page, designation, name }],
    queryFn: () =>
      getTeam({
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
    queryKey: ["staff", "team", "pending"],
    queryFn: () => getTeam({ section: "pending", limit: 100 }),
    enabled: isManager,
  });
  const pendingMembers = pendingQuery.data?.data ?? [];

  const approve = useMutation({
    mutationFn: (userID: number) => updateTeamStatus(userID, "Active"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "team"] });
      toast.success("Staff member approved");
    },
    onError: () => toast.error("Couldn't approve this staff member. Please try again."),
  });

  if (profile && !isManager) {
    return <Navigate to="/forbidden" replace />;
  }

  return (
    <div>
      <DashboardHeading title="Staff" emoji="👩‍💼" message="Manage your shelter team" />

      <Card className="mb-6 p-6">
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
          <DashboardEmptyMessage>No staff match your filters.</DashboardEmptyMessage>
        )}

        {members.length > 0 && (
          <ul className="flex flex-col gap-4">
            {members.map((member) => (
              <li key={member.userID}>
                <DashboardListRow
                  title={member.staffName}
                  lines={memberLines(member)}
                  badge={
                    member.accountStatus === "Deactivated"
                      ? { label: "Deactivated", tone: "gray" }
                      : undefined
                  }
                  actions={
                    // Not on yourself (nothing a manager can change on their
                    // own row here) or on deactivated staff.
                    member.userID !== profile?.userID &&
                    member.accountStatus === "Active" ? (
                      <RowActionButton onClick={() => setEditing(member)}>
                        Edit
                      </RowActionButton>
                    ) : undefined
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

      <Card className="p-6">
        <DashboardWidgetHeader icon="🧑‍💼" title="Staff Approvals" className="mb-4" />

        {pendingQuery.isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {pendingQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load pending staff. Please try again.
          </p>
        )}
        {pendingQuery.data && pendingMembers.length === 0 && (
          <DashboardEmptyMessage>No staff awaiting approval.</DashboardEmptyMessage>
        )}

        {pendingMembers.length > 0 && (
          <DashboardActionList
            items={pendingMembers}
            getKey={(member) => member.userID}
            renderRow={(member, confirm) => (
              <DashboardListRow
                title={member.staffName}
                lines={memberLines(member)}
                actions={
                  <>
                    <RowActionButton
                      variant="success"
                      disabled={approve.isPending}
                      onClick={() => approve.mutate(member.userID)}
                    >
                      Approve
                    </RowActionButton>
                    <RowActionButton variant="danger" onClick={() => confirm(member)}>
                      Decline
                    </RowActionButton>
                  </>
                }
              />
            )}
            confirmAction={{
              mutationFn: (member) => updateTeamStatus(member.userID, "Deactivated"),
              invalidateKeys: [["staff", "team"]],
              successToast: "Staff member declined",
              errorToast: "Couldn't decline this staff member. Please try again.",
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

      {/* key remounts the panel per member so it seeds that member's designation. */}
      <StaffEditPanel
        key={editing?.userID ?? "none"}
        member={editing}
        onClose={() => setEditing(null)}
      />
    </div>
  );
};

export default Team;
