import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BiFilterAlt } from "react-icons/bi";
import Card from "../../../../components/ui/Card";
import ButtonElement from "../../../../components/ui/ButtonElement";
import SelectField from "../../../../components/ui/SelectField";
import Avatar from "../../../../components/ui/Avatar";
import Badge, { type BadgeTone } from "../../../../components/ui/Badge";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import {
  DashboardListRow,
  RowActionButton,
} from "../../../../components/ui/dashboard/DashboardList";
import {
  getAdmins,
  getAdminsPage,
  type AdminAccountStatus,
} from "../../../../logic/api/adminsApi";
import useAuthStore from "../../../../logic/store/useAuthStore";
import AdminDetailPanel from "./sections/admins/AdminDetailPanel";
import AdminApprovalPanel from "./sections/admins/AdminApprovalPanel";

const PAGE_SIZE = 10;

type StatusFilter = AdminAccountStatus | "all";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "Pending", label: "Pending" },
  { value: "Active", label: "Active" },
  { value: "Deactivated", label: "Deactivated" },
];

const STATUS_TONE: Record<AdminAccountStatus, BadgeTone> = {
  Pending: "gold",
  Active: "green",
  Deactivated: "gray",
};

// Admins tab — org-wide admin listing, filterable by status, paginated. Rows
// open a detail slide-over with the profile and an Activate/Deactivate
// toggle. Same layout as the Staff tab; Admin just has no
// designation/shelter to filter or edit.
const Admins = () => {
  const currentUserID = useAuthStore((state) => state.user?.userID);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);
  const [approvalOpenId, setApprovalOpenId] = useState<number | null>(null);

  // Self-registered admins awaiting approval — a small, un-paginated list
  // (see AdminApprovalPanel for the Approve/Decline flow).
  const { data: pendingAdmins, isLoading: pendingLoading } = useQuery({
    queryKey: ["admin", "admins", "pending"],
    queryFn: () => getAdmins({ accountStatus: "Pending", limit: 100 }),
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "admins", "page", { page, statusFilter }],
    queryFn: () =>
      getAdminsPage({
        page,
        limit: PAGE_SIZE,
        accountStatus: statusFilter === "all" ? undefined : statusFilter,
      }),
    placeholderData: keepPreviousData,
  });

  const admins = data?.data ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;
  const hasFilters = statusFilter !== "all";

  const changeFilter = <T,>(setter: (v: T) => void, value: T) => {
    setter(value);
    setPage(1);
  };

  return (
    <div>
      <DashboardHeading
        title="Admins"
        emoji="🛡️"
        message="Every admin account across the organisation"
      />

      {/* Filters */}
      <Card className="mb-6 p-5">
        <div className="mb-3 flex items-center gap-2 font-body text-sm font-semibold text-neutral-charcoal">
          <BiFilterAlt />
          Filters
        </div>
        <div className="flex flex-col gap-4 sm:flex-row">
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
          Loading admins…
        </p>
      )}

      {isError && (
        <p className="font-body text-sm text-rose-dark">
          Couldn't load admins. Please try again.
        </p>
      )}

      {data && admins.length === 0 && (
        <div className="rounded-2xl bg-white p-10 text-center shadow-md">
          <DashboardEmptyMessage>
            {hasFilters
              ? "No admins match these filters."
              : "No admin accounts yet."}
          </DashboardEmptyMessage>
        </div>
      )}

      {admins.length > 0 && (
        <Card className="p-6">
          <ul className="flex flex-col gap-4">
            {admins.map((admin) => (
              <li key={admin.userID}>
                <DashboardListRow
                  leading={
                    <Avatar
                      seed={admin.avatarSeed}
                      size={48}
                      className="h-12 w-12 shrink-0 rounded-full ring-2 ring-teal-dark"
                    />
                  }
                  title={
                    <span className="inline-flex items-center gap-2">
                      {admin.adminName}
                      {admin.userID === currentUserID && (
                        <Badge tone="teal" className="shrink-0">
                          You
                        </Badge>
                      )}
                    </span>
                  }
                  lines={[{ text: admin.user.userEmail }]}
                  badge={
                    admin.accountStatus
                      ? {
                          label: admin.accountStatus,
                          tone: STATUS_TONE[admin.accountStatus],
                        }
                      : undefined
                  }
                  actions={
                    <RowActionButton onClick={() => setOpenId(admin.userID)}>
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
                type="button"
                size="bare"
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-neutral-gray px-4 py-2 text-sm font-medium text-neutral-dark hover:bg-neutral-lightgray disabled:opacity-40"
              >
                Previous
              </ButtonElement>
              <span className="font-body text-sm text-neutral-gray">
                Page {page} of {totalPages}
              </span>
              <ButtonElement
                type="button"
                size="bare"
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-neutral-gray px-4 py-2 text-sm font-medium text-neutral-dark hover:bg-neutral-lightgray disabled:opacity-40"
              >
                Next
              </ButtonElement>
            </div>
          )}
        </Card>
      )}

      {/* Admin Approvals */}
      <Card className="mt-6 p-6">
        <h2 className="mb-4 flex items-center gap-2 font-display text-2xl text-neutral-dark">
          🛡️ Admin Approvals
        </h2>

        {pendingLoading ? (
          <p className="py-6 text-center font-body text-sm text-neutral-gray">
            Loading pending admins…
          </p>
        ) : !pendingAdmins || pendingAdmins.length === 0 ? (
          <DashboardEmptyMessage>
            No admins awaiting approval.
          </DashboardEmptyMessage>
        ) : (
          <ul className="flex flex-col gap-4">
            {pendingAdmins.map((admin) => (
              <li key={admin.userID}>
                <DashboardListRow
                  leading={
                    <Avatar
                      seed={admin.avatarSeed}
                      size={48}
                      className="h-12 w-12 shrink-0 rounded-full ring-2 ring-teal-dark"
                    />
                  }
                  title={admin.adminName}
                  lines={[{ text: admin.user.userEmail }]}
                  actions={
                    <RowActionButton
                      onClick={() => setApprovalOpenId(admin.userID)}
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

      <AdminDetailPanel userID={openId} onClose={() => setOpenId(null)} />
      <AdminApprovalPanel
        userID={approvalOpenId}
        onClose={() => setApprovalOpenId(null)}
      />
    </div>
  );
};

export default Admins;
