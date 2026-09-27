import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Card from "../../../../components/ui/Card";
import SelectField from "../../../../components/ui/SelectField";
import Avatar from "../../../../components/ui/Avatar";
import PhoneDisplay from "../../../../components/ui/PhoneDisplay";
import type { BadgeTone } from "../../../../components/ui/Badge";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import DashboardWidgetHeader from "../../../../components/ui/dashboard/DashboardWidgetHeader";
import PaginationControls from "../../../../components/ui/dashboard/PaginationControls";
import {
  DashboardListRow,
  RowActionButton,
} from "../../../../components/ui/dashboard/DashboardList";
import {
  getStaff,
  getStaffPage,
  type StaffAccountStatus,
  type StaffDesignation,
  type StaffListItem,
} from "../../../../logic/api/staffApi";
import { getShelterAnalytics } from "../../../../logic/api/analyticsApi";
import StaffDetailPanel from "./sections/staff/StaffDetailPanel";
import StaffApprovalPanel from "./sections/staff/StaffApprovalPanel";

const PAGE_SIZE = 10;

type ShelterFilter = number | "all";
type DesignationFilter = StaffDesignation | "all";
type StatusFilter = StaffAccountStatus | "all";

const DESIGNATION_OPTIONS: { value: DesignationFilter; label: string }[] = [
  { value: "all", label: "All Designations" },
  { value: "Manager", label: "Manager" },
  { value: "Senior", label: "Senior" },
  { value: "Associate", label: "Associate" },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "Pending", label: "Pending" },
  { value: "Active", label: "Active" },
  { value: "Deactivated", label: "Deactivated" },
];

const STATUS_TONE: Record<StaffAccountStatus, BadgeTone> = {
  Pending: "gold",
  Active: "green",
  Deactivated: "gray",
};

// Matches SelectField's own label + trigger sizing, same as the Staff
// dashboard's Staff.tsx.
const filterInputClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark";
const filterLabelClass =
  "mb-1.5 block font-body text-sm font-semibold text-neutral-charcoal";

// Shared by both sections' rows — same layout as the Staff dashboard's
// Staff tab: avatar | name + designation + shelter | phone and email inline
// | actions.
const memberRowProps = (member: StaffListItem) => ({
  leading: (
    <Avatar
      seed={member.avatarSeed}
      alt={`${member.staffName} avatar`}
      size={48}
      className="h-12 w-12 shrink-0 rounded-full ring-2 ring-teal-dark"
    />
  ),
  title: member.staffName,
  lines: [
    { text: member.staffDesignation ?? "No designation" },
    { text: member.shelter?.shelterName ?? "No shelter assigned" },
  ],
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
        <span className="truncate">{member.user.userEmail}</span>
      </span>
    </>
  ),
});

// Staff tab — Manager Approvals (Pending Manager sign-ups: the first staff
// sign-up at a shelter without a manager registers as its Manager, and only
// Admin approves those; everyone else is approved by their shelter's
// manager) above All Staff (org-wide, filterable by shelter/designation/
// status + name search, paginated). Same card-per-section layout as the
// Staff dashboard's Staff tab. Rows open StaffApprovalPanel (approve/
// decline) or StaffDetailPanel (full profile, designation + shelter edits).
const Staff = () => {
  const [shelterFilter, setShelterFilter] = useState<ShelterFilter>("all");
  const [designationFilter, setDesignationFilter] =
    useState<DesignationFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [name, setName] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);
  const [approvalOpenId, setApprovalOpenId] = useState<number | null>(null);
  // Manager Approvals' own filters — independent of All Staff's. No
  // Designation/Status here: every row is a Pending Manager sign-up.
  const [pendingShelter, setPendingShelter] = useState<ShelterFilter>("all");
  const [pendingName, setPendingName] = useState("");

  const { data: shelters } = useQuery({
    queryKey: ["admin", "shelters-analytics"],
    queryFn: () => getShelterAnalytics(),
  });

  // A small, un-paginated list; see StaffApprovalPanel for Approve/Decline.
  const pendingQuery = useQuery({
    queryKey: ["admin", "staff", "pending", { pendingShelter, pendingName }],
    queryFn: () =>
      getStaff({
        awaitingAdmin: true,
        shelterID: pendingShelter === "all" ? undefined : pendingShelter,
        name: pendingName.trim() || undefined,
        limit: 100,
      }),
    placeholderData: keepPreviousData,
  });
  const pendingStaff = pendingQuery.data ?? [];
  const hasPendingFilters =
    pendingShelter !== "all" || pendingName.trim() !== "";

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "admin",
      "staff",
      "page",
      { page, shelterFilter, designationFilter, statusFilter, name },
    ],
    queryFn: () =>
      getStaffPage({
        page,
        limit: PAGE_SIZE,
        shelterID: shelterFilter === "all" ? undefined : shelterFilter,
        staffDesignation:
          designationFilter === "all" ? undefined : designationFilter,
        accountStatus: statusFilter === "all" ? undefined : statusFilter,
        name: name.trim() || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const staff = data?.data ?? [];
  const hasFilters =
    shelterFilter !== "all" ||
    designationFilter !== "all" ||
    statusFilter !== "all" ||
    name.trim() !== "";

  const shelterOptions = [
    { value: "all", label: "All Shelters" },
    ...(shelters ?? []).map((s) => ({
      value: String(s.shelterID),
      label: s.shelterName,
    })),
  ];

  const changeFilter = <T,>(setter: (v: T) => void, value: T) => {
    setter(value);
    setPage(1);
  };

  return (
    <div>
      <DashboardHeading
        title="Staff"
        emoji="🧑‍💼"
        message="Every staff member across the network"
      />

      <Card className="mb-6 p-6">
        <DashboardWidgetHeader
          icon="🧑‍💼"
          title="Manager Approvals"
          className="mb-4"
        />

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Shelter"
            value={String(pendingShelter)}
            onChange={(v) => setPendingShelter(v === "all" ? "all" : Number(v))}
            options={shelterOptions}
          />
          <div>
            <label className={filterLabelClass} htmlFor="admin-pending-name">
              Staff Name
            </label>
            <input
              id="admin-pending-name"
              placeholder="Search by staff name"
              value={pendingName}
              onChange={(e) => setPendingName(e.target.value)}
              className={filterInputClass}
            />
          </div>
        </div>

        {pendingQuery.isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {pendingQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load pending managers. Please try again.
          </p>
        )}
        {pendingQuery.data && pendingStaff.length === 0 && (
          <DashboardEmptyMessage>
            {hasPendingFilters
              ? "No pending managers match your filters."
              : "No managers awaiting approval. Other staff are approved by their shelter's manager."}
          </DashboardEmptyMessage>
        )}

        {pendingStaff.length > 0 && (
          <ul className="flex flex-col gap-4">
            {pendingStaff.map((member) => (
              <li key={member.userID}>
                <DashboardListRow
                  {...memberRowProps(member)}
                  actions={
                    <RowActionButton
                      onClick={() => setApprovalOpenId(member.userID)}
                    >
                      View Details
                    </RowActionButton>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-6">
        <DashboardWidgetHeader icon="🧑‍💼" title="All Staff" className="mb-4" />

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField
            label="Shelter"
            value={String(shelterFilter)}
            onChange={(v) =>
              changeFilter(setShelterFilter, v === "all" ? "all" : Number(v))
            }
            options={shelterOptions}
          />
          <SelectField
            label="Designation"
            value={designationFilter}
            onChange={(v) =>
              changeFilter(setDesignationFilter, v as DesignationFilter)
            }
            options={DESIGNATION_OPTIONS}
          />
          <SelectField
            label="Status"
            value={statusFilter}
            onChange={(v) => changeFilter(setStatusFilter, v as StatusFilter)}
            options={STATUS_OPTIONS}
          />
          <div>
            <label className={filterLabelClass} htmlFor="admin-staff-name">
              Staff Name
            </label>
            <input
              id="admin-staff-name"
              placeholder="Search by staff name"
              value={name}
              onChange={(e) => changeFilter(setName, e.target.value)}
              className={filterInputClass}
            />
          </div>
        </div>

        {isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load staff. Please try again.
          </p>
        )}
        {data && staff.length === 0 && (
          <DashboardEmptyMessage>
            {hasFilters
              ? "No staff match your filters."
              : "No staff members yet."}
          </DashboardEmptyMessage>
        )}

        {staff.length > 0 && (
          <ul className="flex flex-col gap-4">
            {staff.map((member) => (
              <li key={member.userID}>
                <DashboardListRow
                  {...memberRowProps(member)}
                  // Same as the Staff dashboard: only a non-Active account
                  // gets a status badge.
                  badge={
                    member.accountStatus && member.accountStatus !== "Active"
                      ? {
                          label: member.accountStatus,
                          tone: STATUS_TONE[member.accountStatus],
                        }
                      : undefined
                  }
                  actions={
                    <RowActionButton onClick={() => setOpenId(member.userID)}>
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
          totalPages={data?.pagination.totalPages ?? 1}
          onChange={setPage}
        />
      </Card>

      <StaffDetailPanel userID={openId} onClose={() => setOpenId(null)} />
      <StaffApprovalPanel
        userID={approvalOpenId}
        onClose={() => setApprovalOpenId(null)}
      />
    </div>
  );
};

export default Staff;
