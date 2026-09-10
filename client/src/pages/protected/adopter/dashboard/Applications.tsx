import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BiFilterAlt } from "react-icons/bi";
import { TbListCheck } from "react-icons/tb";
import ButtonElement from "../../../../components/ui/ButtonElement";
import Card from "../../../../components/ui/Card";
import SelectField from "../../../../components/ui/SelectField";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import {
  getMyApplicationsPage,
  type ApplicationStatus,
} from "../../../../logic/api/adoptersApi";
import { APPLICATION_STATUS_META } from "../../../../logic/adopter/applicationStatus";
import ApplicationsList from "./shared/ApplicationsList";
import ApplicationDetailPanel from "./applications/ApplicationDetailPanel";

const PAGE_SIZE = 10;

type StatusFilter = ApplicationStatus | "all";

// Adopter-facing labels (Pending → "Under Consideration", …) over the raw enum
// values the API filters on.
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  ...(
    Object.keys(APPLICATION_STATUS_META) as ApplicationStatus[]
  ).map((value) => ({ value, label: APPLICATION_STATUS_META[value].label })),
];

// "Applications" section of the adopter dashboard — the full, paginated list
// with a status filter. Rows open a detail slide-over; deep-linked via
// ?applicationID from the Overview widget (read once on mount, then stripped).
const Applications = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [openId, setOpenId] = useState<number | null>(() => {
    const id = Number(searchParams.get("applicationID"));
    return Number.isInteger(id) && id > 0 ? id : null;
  });

  useEffect(() => {
    if (searchParams.has("applicationID")) {
      searchParams.delete("applicationID");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["adopter", "applications", "page", { page, status }],
    queryFn: () =>
      getMyApplicationsPage({
        page,
        limit: PAGE_SIZE,
        status: status === "all" ? undefined : status,
      }),
    placeholderData: keepPreviousData,
  });

  const applications = data?.data ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;

  const changeStatus = (next: StatusFilter) => {
    setStatus(next);
    setPage(1);
  };

  return (
    <div>
      <DashboardHeading
        title="Applications"
        emoji="📋"
        message="Track your adoption applications"
      />

      {/* Filters */}
      <Card className="mb-6 p-5">
        <div className="mb-3 flex items-center gap-2 font-body text-sm font-semibold text-neutral-charcoal">
          <BiFilterAlt />
          Filters
        </div>
        <SelectField
          label="Status"
          icon={<TbListCheck className="text-neutral-gray" />}
          className="max-w-xs"
          value={status}
          onChange={(v) => changeStatus(v as StatusFilter)}
          options={STATUS_OPTIONS}
        />
      </Card>

      {isLoading && (
        <p className="font-body text-sm text-neutral-gray">
          Loading your applications…
        </p>
      )}

      {isError && (
        <p className="font-body text-sm text-rose-dark">
          Couldn't load your applications. Please try again.
        </p>
      )}

      {data && applications.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-10 text-center shadow-md">
          <DashboardEmptyMessage>
            {status === "all"
              ? "You haven't applied to adopt any pets yet."
              : "No applications with this status."}
          </DashboardEmptyMessage>
          {status === "all" && (
            <ButtonElement
              to="/adopt"
              className="bg-teal-dark hover:bg-gold-dark"
            >
              Explore Pets
            </ButtonElement>
          )}
        </div>
      )}

      {applications.length > 0 && (
        <Card className="p-6">
          <ApplicationsList
            applications={applications}
            onViewDetails={setOpenId}
          />

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
