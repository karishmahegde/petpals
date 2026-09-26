import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardWidgetHeader from "../../../../components/ui/dashboard/DashboardWidgetHeader";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import PaginationControls from "../../../../components/ui/dashboard/PaginationControls";
import Avatar from "../../../../components/ui/Avatar";
import Card from "../../../../components/ui/Card";
import SelectField from "../../../../components/ui/SelectField";
import PhoneDisplay from "../../../../components/ui/PhoneDisplay";
import {
  DashboardListRow,
  RowActionButton,
  type RowBadge,
} from "../../../../components/ui/dashboard/DashboardList";
import {
  getAdopters,
  type AdopterAccountStatus,
  type AdopterListItem,
} from "../../../../logic/api/staffAdoptersApi";
import AdopterDetailPanel from "./sections/adopters/AdopterDetailPanel";
import { ADOPTER_STATUS_TONE } from "../../../../logic/staff/adopterStatus";

const PAGE_SIZE = 20;

type StatusFilter = AdopterAccountStatus | "all";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "Active", label: "Active" },
  { value: "Banned", label: "Banned" },
  { value: "Deactivated", label: "Deactivated" },
];

// Matches SelectField's own label + trigger sizing, same as Staff.tsx.
const filterInputClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark";
const filterLabelClass =
  "mb-1.5 block font-body text-sm font-semibold text-neutral-charcoal";

// A non-Active account shows its status; otherwise a Pre Approved adopter
// gets that badge instead.
const rowBadge = (adopter: AdopterListItem): RowBadge | undefined =>
  adopter.accountStatus !== "Active"
    ? {
        label: adopter.accountStatus,
        tone: ADOPTER_STATUS_TONE[adopter.accountStatus],
      }
    : adopter.preQualifyFlag
      ? { label: "Pre Approved", tone: "green" }
      : undefined;

const isValidID = (value: string | null): boolean => {
  const id = Number(value);
  return value !== null && Number.isInteger(id) && id > 0;
};

// Adopters tab (People → Adopters) — a read-only directory of every adopter
// account (adopters aren't tied to one shelter, so this is network-wide),
// with status filter + name search. Same row layout as the Staff/Vets tabs;
// "View Details" opens AdopterDetailPanel with the full profile. No
// approve/deactivate here — adopters need no approval, and banning is
// Admin-only. Deep-linked via ?adopterID= (e.g. from an adopted pet's
// panel), read once on mount (same pattern as Pets' ?petID=).
const Adopters = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewingID, setViewingID] = useState<number | null>(() => {
    const adopterID = searchParams.get("adopterID");
    return isValidID(adopterID) ? Number(adopterID) : null;
  });

  useEffect(() => {
    if (searchParams.has("adopterID")) {
      searchParams.delete("adopterID");
      setSearchParams(searchParams, { replace: true });
    }
    // Run once on mount — the initial state above already captured the value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [name, setName] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["staff", "adopters", { page, status, name }],
    queryFn: () =>
      getAdopters({
        accountStatus: status === "all" ? undefined : status,
        name: name.trim() || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });
  const adopters = data?.data ?? [];

  return (
    <div>
      <DashboardHeading
        title="Adopters"
        emoji="🏡"
        message="Browse adopter accounts across the network"
      />

      <Card className="p-6">
        <DashboardWidgetHeader
          icon="👪"
          title="All Adopters"
          className="mb-4"
        />

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Status"
            value={status}
            onChange={(v) => {
              setStatus(v as StatusFilter);
              setPage(1);
            }}
            options={STATUS_OPTIONS}
          />
          <div>
            <label className={filterLabelClass} htmlFor="adopter-name-search">
              Adopter Name
            </label>
            <input
              id="adopter-name-search"
              placeholder="Search by adopter name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setPage(1);
              }}
              className={filterInputClass}
            />
          </div>
        </div>

        {isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load adopters. Please try again.
          </p>
        )}
        {data && adopters.length === 0 && (
          <DashboardEmptyMessage>
            No adopters match your filters.
          </DashboardEmptyMessage>
        )}

        {adopters.length > 0 && (
          <ul className="flex flex-col gap-4">
            {adopters.map((adopter) => (
              <li key={adopter.userID}>
                <DashboardListRow
                  leading={
                    <Avatar
                      seed={adopter.avatarSeed}
                      alt={`${adopter.adopterName} avatar`}
                      size={48}
                      className="h-12 w-12 shrink-0 rounded-full ring-2 ring-teal-dark"
                    />
                  }
                  title={adopter.adopterName}
                  lines={[
                    {
                      text:
                        [adopter.city, adopter.state]
                          .filter(Boolean)
                          .join(", ") || "Location not set",
                    },
                  ]}
                  details={
                    <>
                      <span className="flex items-center gap-2">
                        <span
                          role="img"
                          aria-label="Phone"
                          className="shrink-0"
                        >
                          ☎️
                        </span>
                        {adopter.adopterPhone ? (
                          <PhoneDisplay value={adopter.adopterPhone} />
                        ) : (
                          "No phone"
                        )}
                      </span>
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          role="img"
                          aria-label="Email"
                          className="shrink-0"
                        >
                          ✉️
                        </span>
                        <span className="truncate">
                          {adopter.user.userEmail}
                        </span>
                      </span>
                    </>
                  }
                  badge={rowBadge(adopter)}
                  actions={
                    <RowActionButton
                      onClick={() => setViewingID(adopter.userID)}
                    >
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

      <AdopterDetailPanel
        adopterID={viewingID}
        onClose={() => setViewingID(null)}
      />
    </div>
  );
};

export default Adopters;
