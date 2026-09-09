import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import ButtonElement from "../../../../components/ui/ButtonElement";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import { getMyApplicationsPage } from "../../../../logic/api/adoptersApi";
import ApplicationsList from "./shared/ApplicationsList";

const PAGE_SIZE = 10;

// "Applications" section of the adopter dashboard — the full, paginated list.
const Applications = () => {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["adopter", "applications", "page", page],
    queryFn: () => getMyApplicationsPage({ page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const applications = data?.data ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <div>
      <DashboardHeading
        title="Applications"
        emoji="📋"
        message="Track your adoption applications"
      />

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
            You haven't applied to adopt any pets yet.
          </DashboardEmptyMessage>
          <ButtonElement to="/adopt" className="bg-teal-dark hover:bg-gold-dark">
            Explore Pets
          </ButtonElement>
        </div>
      )}

      {applications.length > 0 && (
        <>
          <ApplicationsList applications={applications} />

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
        </>
      )}
    </div>
  );
};

export default Applications;
