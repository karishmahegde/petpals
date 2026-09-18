import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BiFilterAlt } from "react-icons/bi";
import { PiBuildingsBold, PiIdentificationBadgeBold } from "react-icons/pi";
import Card from "../../../../components/ui/Card";
import ButtonElement from "../../../../components/ui/ButtonElement";
import SelectField from "../../../../components/ui/SelectField";
import Avatar from "../../../../components/ui/Avatar";
import type { BadgeTone } from "../../../../components/ui/Badge";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import {
  DashboardListRow,
  RowActionButton,
} from "../../../../components/ui/dashboard/DashboardList";
import {
  getStaff,
  getStaffPage,
  type StaffAccountStatus,
  type StaffDesignation,
} from "../../../../logic/api/staffApi";
import { getShelterAnalytics } from "../../../../logic/api/analyticsApi";
import StaffDetailPanel from "./sections/staff/StaffDetailPanel";
import StaffApprovalPanel from "./sections/staff/StaffApprovalPanel";

const PAGE_SIZE = 10;

type ShelterFilter = number | "all";
type DesignationFilter = StaffDesignation | "all";
type StatusFilter = StaffAccountStatus | "all";

const DESIGNATION_OPTIONS: { value: DesignationFilter; label: string }[] = [
  { value: "all", label: "All designations" },
  { value: "Manager", label: "Manager" },
  { value: "Senior", label: "Senior" },
  { value: "Associate", label: "Associate" },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "Pending", label: "Pending" },
  { value: "Active", label: "Active" },
  { value: "Deactivated", label: "Deactivated" },
];

const STATUS_TONE: Record<StaffAccountStatus, BadgeTone> = {
  Pending: "gold",
  Active: "green",
  Deactivated: "gray",
};

// Staff tab — org-wide staff listing, filterable by shelter/designation/
// status, paginated. Rows open a detail slide-over with the full profile and
// an edit form for designation + shelter reassignment.
const Staff = () => {
  const [shelterFilter, setShelterFilter] = useState<ShelterFilter>("all");
  const [designationFilter, setDesignationFilter] =
    useState<DesignationFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);
  const [approvalOpenId, setApprovalOpenId] = useState<number | null>(null);

  const { data: shelters } = useQuery({
    queryKey: ["admin", "shelters-analytics"],
    queryFn: () => getShelterAnalytics(),
  });

  // Self-registered staff awaiting approval — a small, un-paginated list
  // (there's no self-service Staff registration path yet, so this stays
  // short in practice; see StaffApprovalPanel for the Approve/Decline flow).
  const { data: pendingStaff, isLoading: pendingLoading } = useQuery({
    queryKey: ["admin", "staff", "pending"],
    queryFn: () => getStaff({ accountStatus: "Pending", limit: 100 }),
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "admin",
      "staff",
      "page",
      { page, shelterFilter, designationFilter, statusFilter },
    ],
    queryFn: () =>
      getStaffPage({
        page,
        limit: PAGE_SIZE,
        shelterID: shelterFilter === "all" ? undefined : shelterFilter,
        staffDesignation:
          designationFilter === "all" ? undefined : designationFilter,
        accountStatus: statusFilter === "all" ? undefined : statusFilter,
      }),
    placeholderData: keepPreviousData,
  });

  const staff = data?.data ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;
  const hasFilters =
    shelterFilter !== "all" || designationFilter !== "all" || statusFilter !== "all";

  const shelterOptions = [
    { value: "all", label: "All shelters" },
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

      {/* Filters */}
      <Card className="mb-6 p-5">
        <div className="mb-3 flex items-center gap-2 font-body text-sm font-semibold text-neutral-charcoal">
          <BiFilterAlt />
          Filters
        </div>
        <div className="flex flex-col gap-4 sm:flex-row">
          <SelectField
            label="Shelter"
            icon={<PiBuildingsBold className="text-neutral-gray" />}
            className="flex-1"
            value={String(shelterFilter)}
            onChange={(v) =>
              changeFilter(
                setShelterFilter,
                v === "all" ? "all" : Number(v),
              )
            }
            options={shelterOptions}
          />
          <SelectField
            label="Designation"
            icon={<PiIdentificationBadgeBold className="text-neutral-gray" />}
            className="flex-1"
            value={designationFilter}
            onChange={(v) =>
              changeFilter(setDesignationFilter, v as DesignationFilter)
            }
            options={DESIGNATION_OPTIONS}
          />
          <SelectField
            label="Status"
            className="flex-1"
            value={statusFilter}
            onChange={(v) => changeFilter(setStatusFilter, v as StatusFilter)}
            options={STATUS_OPTIONS}
          />
        </div>
      </Card>

      {isLoading && (
        <p className="font-body text-sm text-neutral-gray">
          Loading staff…
        </p>
      )}

      {isError && (
        <p className="font-body text-sm text-rose-dark">
          Couldn't load staff. Please try again.
        </p>
      )}

      {data && staff.length === 0 && (
        <div className="rounded-2xl bg-white p-10 text-center shadow-md">
          <DashboardEmptyMessage>
            {hasFilters
              ? "No staff match these filters."
              : "No staff members yet."}
          </DashboardEmptyMessage>
        </div>
      )}

      {staff.length > 0 && (
        <Card className="p-6">
          <ul className="flex flex-col gap-4">
            {staff.map((member) => (
              <li key={member.userID}>
                <DashboardListRow
                  leading={
                    <Avatar
                      seed={member.avatarSeed}
                      size={48}
                      className="h-12 w-12 shrink-0 rounded-full ring-2 ring-teal-dark"
                    />
                  }
                  title={member.staffName}
                  lines={[
                    { text: member.shelter?.shelterName ?? "No shelter assigned" },
                    { text: member.staffDesignation ?? "No designation set" },
                  ]}
                  badge={
                    member.accountStatus
                      ? {
                          label: member.accountStatus,
                          tone: STATUS_TONE[member.accountStatus],
                        }
                      : undefined
                  }
                  actions={
                    <RowActionButton onClick={() => setOpenId(member.userID)}>
                      View
                    </RowActionButton>
                  }
                />
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-4">
              <ButtonElement
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                size="bare"
                variant="outline"
                className="rounded-lg border border-neutral-gray px-4 py-2 font-body text-sm font-medium text-neutral-dark transition-colors hover:bg-neutral-lightgray disabled:opacity-40"
              >
                Previous
              </ButtonElement>
              <span className="font-body text-sm text-neutral-gray">
                Page {page} of {totalPages}
              </span>
              <ButtonElement
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                size="bare"
                variant="outline"
                className="rounded-lg border border-neutral-gray px-4 py-2 font-body text-sm font-medium text-neutral-dark transition-colors hover:bg-neutral-lightgray disabled:opacity-40"
              >
                Next
              </ButtonElement>
            </div>
          )}
        </Card>
      )}

      {/* Staff Approvals */}
      <Card className="mt-6 p-6">
        <h2 className="mb-4 flex items-center gap-2 font-display text-2xl text-neutral-dark">
          🧑‍💼 Staff Approvals
        </h2>

        {pendingLoading ? (
          <p className="py-6 text-center font-body text-sm text-neutral-gray">
            Loading pending staff…
          </p>
        ) : !pendingStaff || pendingStaff.length === 0 ? (
          <DashboardEmptyMessage>
            No staff awaiting approval.
          </DashboardEmptyMessage>
        ) : (
          <ul className="flex flex-col gap-4">
            {pendingStaff.map((member) => (
              <li key={member.userID}>
                <DashboardListRow
                  leading={
                    <Avatar
                      seed={member.avatarSeed}
                      size={48}
                      className="h-12 w-12 shrink-0 rounded-full ring-2 ring-teal-dark"
                    />
                  }
                  title={member.staffName}
                  lines={[{ text: member.user.userEmail }]}
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

      <StaffDetailPanel userID={openId} onClose={() => setOpenId(null)} />
      <StaffApprovalPanel
        userID={approvalOpenId}
        onClose={() => setApprovalOpenId(null)}
      />
    </div>
  );
};

export default Staff;
