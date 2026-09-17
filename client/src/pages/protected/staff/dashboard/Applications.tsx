import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FaPaw } from "react-icons/fa";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import Card from "../../../../components/ui/Card";
import SelectField from "../../../../components/ui/SelectField";
import type { BadgeTone } from "../../../../components/ui/Badge";
import {
  DashboardListRow,
  RowActionButton,
  RowMedallion,
} from "../../../../components/ui/dashboard/DashboardList";
import { getApplicationsQueue } from "../../../../logic/api/adoptionApplicationsApi";
import { formatShortDate } from "../../../../logic/utils/datetime";
import ApplicationDetailPanel from "./sections/applications/ApplicationDetailPanel";

const PAGE_SIZE = 20;

type ApplicationStatus = "Pending" | "Accepted" | "Rejected" | "Withdrawn";
type StatusFilter = ApplicationStatus | "all";

const STATUS_TONE: Record<ApplicationStatus, BadgeTone> = {
  Pending: "gold",
  Accepted: "green",
  Rejected: "red",
  Withdrawn: "gray",
};

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "Pending", label: "Pending" },
  { value: "Accepted", label: "Accepted" },
  { value: "Rejected", label: "Rejected" },
  { value: "Withdrawn", label: "Withdrawn" },
];

// Applications tab — the shelter's adoption application queue
// (GET /adoption-applications, staff-scoped server-side to their own
// shelter), with a detail slide-over for the full picture (adopter info,
// pet info, shelterMessage) and Accept/Reject. Entry from the Overview
// widget deep-links via ?applicationID=, read once on mount (same pattern
// as adopter dashboard's Pets.tsx ?petID=).
const Applications = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [openId, setOpenId] = useState<number | null>(() => {
    const applicationID = Number(searchParams.get("applicationID"));
    return Number.isInteger(applicationID) && applicationID > 0
      ? applicationID
      : null;
  });

  useEffect(() => {
    if (searchParams.has("applicationID")) {
      searchParams.delete("applicationID");
      setSearchParams(searchParams, { replace: true });
    }
    // Run once on mount — the initial state above already captured the value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const changeStatusFilter = (value: StatusFilter) => {
    setStatusFilter(value);
    setPage(1);
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["staff", "applications-queue", { page, statusFilter }],
    queryFn: () =>
      getApplicationsQueue({
        page,
        limit: PAGE_SIZE,
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
    placeholderData: keepPreviousData,
  });

  const applications = data?.data ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <div>
      <DashboardHeading
        title="Applications"
        emoji="📋"
        message="Review adoption applications for your shelter"
      />

      <Card className="mb-6 p-5">
        <SelectField
          label="Status"
          className="max-w-xs"
          value={statusFilter}
          onChange={(v) => changeStatusFilter(v as StatusFilter)}
          options={STATUS_OPTIONS}
        />
      </Card>

      {isLoading && (
        <p className="font-body text-sm text-neutral-gray">
          Loading applications…
        </p>
      )}

      {isError && (
        <p className="font-body text-sm text-rose-dark">
          Couldn't load applications. Please try again.
        </p>
      )}

      {data && applications.length === 0 && (
        <div className="rounded-2xl bg-white p-10 text-center shadow-md">
          <DashboardEmptyMessage>
            {statusFilter === "all"
              ? "No applications yet."
              : "No applications match this filter."}
          </DashboardEmptyMessage>
        </div>
      )}

      {applications.length > 0 && (
        <Card className="p-6">
          <ul className="flex flex-col gap-4">
            {applications.map((application) => (
              <li key={application.applicationID}>
                <DashboardListRow
                  leading={
                    <RowMedallion
                      src={application.pet.petPhoto}
                      alt={`${application.pet.petName} photo`}
                      fallback={
                        <FaPaw
                          className="h-6 w-6 text-rose-dark"
                          aria-hidden
                        />
                      }
                    />
                  }
                  title={application.pet.petName}
                  lines={[
                    { text: `Submitted by: ${application.adopter.adopterName}` },
                    {
                      text: `Submitted on: ${formatShortDate(new Date(application.createdAt))}`,
                      strong: true,
                    },
                  ]}
                  badge={{
                    label: application.applicationStatus,
                    tone: STATUS_TONE[application.applicationStatus],
                  }}
                  actions={
                    <RowActionButton
                      onClick={() => setOpenId(application.applicationID)}
                    >
                      View Details
                    </RowActionButton>
                  }
                />
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-neutral-gray px-4 py-2 font-body text-sm font-medium text-neutral-dark transition-colors hover:bg-neutral-lightgray disabled:opacity-40"
              >
                Previous
              </button>
              <span className="font-body text-sm text-neutral-gray">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-neutral-gray px-4 py-2 font-body text-sm font-medium text-neutral-dark transition-colors hover:bg-neutral-lightgray disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </Card>
      )}

      <ApplicationDetailPanel
        applicationID={openId}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
};

export default Applications;
