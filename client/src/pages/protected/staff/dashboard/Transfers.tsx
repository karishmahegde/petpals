import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FaPaw, FaPlus } from "react-icons/fa";
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
import {
  getTransfersQueue,
  type TransferQueueItem,
  type TransferStatus,
} from "../../../../logic/api/transfersApi";
import { formatShortDate } from "../../../../logic/utils/datetime";
import TransferFormPanel from "./sections/transfers/TransferFormPanel";
import TransferDetailPanel from "./sections/transfers/TransferDetailPanel";
import PaginationControls from "../../../../components/ui/dashboard/PaginationControls";
import DashboardWidgetHeader from "../../../../components/ui/dashboard/DashboardWidgetHeader";

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<TransferStatus, string> = {
  In_Progress: "In Progress",
  Completed: "Completed",
  Rejected: "Rejected",
  Cancelled: "Cancelled",
};

const STATUS_TONE: Record<TransferStatus, BadgeTone> = {
  In_Progress: "gold",
  Completed: "green",
  Rejected: "red",
  Cancelled: "gray",
};

type OngoingStatusFilter = TransferStatus | "all";

const ONGOING_STATUS_OPTIONS: { value: OngoingStatusFilter; label: string }[] = [
  { value: "all", label: "All transfers" },
  { value: "In_Progress", label: "In Progress" },
  { value: "Completed", label: "Completed" },
  { value: "Rejected", label: "Rejected" },
  { value: "Cancelled", label: "Cancelled" },
];

// Matches SelectField/Dropdown's own label + trigger sizing (FilterControls.tsx)
// so the "Type" select and these plain text inputs line up in the same row.
const filterInputClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark";
const filterLabelClass =
  "mb-1.5 block font-body text-sm font-semibold text-neutral-charcoal";

interface DetailTarget {
  recordID: number;
  viewAs: "incoming" | "outgoing";
}

const TransferRow = ({
  item,
  onViewDetails,
}: {
  item: TransferQueueItem;
  onViewDetails: () => void;
}) => (
  <DashboardListRow
    leading={
      <RowMedallion
        src={item.pet.petPhoto}
        alt={`${item.pet.petName} photo`}
        fallback={<FaPaw className="h-6 w-6 text-rose-dark" aria-hidden />}
      />
    }
    title={`${item.pet.petName} - ${item.pet.speciesName}`}
    lines={[
      { text: formatShortDate(new Date(item.transferDate)) },
      { text: `${item.fromShelter.shelterName} → ${item.toShelter.shelterName}` },
      { text: `Notes: ${item.transferReason}`, strong: true },
    ]}
    badge={{ label: STATUS_LABEL[item.transferStatus], tone: STATUS_TONE[item.transferStatus] }}
    actions={<RowActionButton onClick={onViewDetails}>View Details</RowActionButton>}
  />
);

// Transfers tab — Incoming Transfers (to this shelter, always filtered to
// In_Progress since those are the only ones awaiting this shelter's
// decision) and Outgoing Transfers (from this shelter, every status by
// default — it's a history/tracking list, not just the still-open ones,
// with a Type filter to narrow it). Entry from the Pets edit panel
// deep-links via ?petID=, read once on mount (same pattern as Applications'
// ?applicationID=), auto-opening TransferFormPanel pre-filled with that pet;
// the heading's "Initiate Transfer" button opens the same panel with no pet
// (presetPetID null → it shows a Pet picker).
const Transfers = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  // null = panel closed; { presetPetID: null } = opened from the heading button.
  const [transferForm, setTransferForm] = useState<{
    presetPetID: number | null;
  } | null>(() => {
    const petID = Number(searchParams.get("petID"));
    return Number.isInteger(petID) && petID > 0 ? { presetPetID: petID } : null;
  });

  useEffect(() => {
    if (searchParams.has("petID")) {
      searchParams.delete("petID");
      setSearchParams(searchParams, { replace: true });
    }
    // Run once on mount — the initial state above already captured the value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [detail, setDetail] = useState<DetailTarget | null>(null);

  const [pendingPage, setPendingPage] = useState(1);
  const [pendingShelterName, setPendingShelterName] = useState("");
  const [pendingPetName, setPendingPetName] = useState("");

  const pendingQuery = useQuery({
    queryKey: [
      "staff",
      "transfers-queue",
      "incoming",
      { page: pendingPage, pendingShelterName, pendingPetName },
    ],
    queryFn: () =>
      getTransfersQueue({
        direction: "incoming",
        status: "In_Progress",
        shelterName: pendingShelterName || undefined,
        petName: pendingPetName || undefined,
        page: pendingPage,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const [ongoingPage, setOngoingPage] = useState(1);
  const [ongoingShelterName, setOngoingShelterName] = useState("");
  const [ongoingPetName, setOngoingPetName] = useState("");
  const [ongoingStatusFilter, setOngoingStatusFilter] =
    useState<OngoingStatusFilter>("all");

  const ongoingQuery = useQuery({
    queryKey: [
      "staff",
      "transfers-queue",
      "outgoing",
      { page: ongoingPage, ongoingShelterName, ongoingPetName, ongoingStatusFilter },
    ],
    queryFn: () =>
      getTransfersQueue({
        direction: "outgoing",
        status: ongoingStatusFilter === "all" ? undefined : ongoingStatusFilter,
        shelterName: ongoingShelterName || undefined,
        petName: ongoingPetName || undefined,
        page: ongoingPage,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const pendingTransfers = pendingQuery.data?.data ?? [];
  const ongoingTransfers = ongoingQuery.data?.data ?? [];

  return (
    <div>
      <DashboardHeading
        title="Transfers"
        emoji="🔄"
        message="Manage inter-shelter animal transfers"
        action={{
          label: "Initiate Transfer",
          icon: <FaPlus aria-hidden />,
          onClick: () => setTransferForm({ presetPetID: null }),
        }}
      />

      <Card className="mb-6 p-6">
        <DashboardWidgetHeader icon="📥" title="Incoming Transfers" className="mb-4" />

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={filterLabelClass} htmlFor="pending-shelter-name">
              Shelter Name
            </label>
            <input
              id="pending-shelter-name"
              placeholder="Search by Shelter Name"
              value={pendingShelterName}
              onChange={(e) => {
                setPendingShelterName(e.target.value);
                setPendingPage(1);
              }}
              className={filterInputClass}
            />
          </div>
          <div>
            <label className={filterLabelClass} htmlFor="pending-pet-name">
              Pet Name
            </label>
            <input
              id="pending-pet-name"
              placeholder="Search by Pet Name"
              value={pendingPetName}
              onChange={(e) => {
                setPendingPetName(e.target.value);
                setPendingPage(1);
              }}
              className={filterInputClass}
            />
          </div>
        </div>

        {pendingQuery.isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {pendingQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load pending transfers. Please try again.
          </p>
        )}
        {pendingQuery.data && pendingTransfers.length === 0 && (
          <DashboardEmptyMessage>
            No transfers are awaiting your shelter's decision.
          </DashboardEmptyMessage>
        )}

        {pendingTransfers.length > 0 && (
          <ul className="flex flex-col gap-4">
            {pendingTransfers.map((item) => (
              <li key={item.recordID}>
                <TransferRow
                  item={item}
                  onViewDetails={() =>
                    setDetail({ recordID: item.recordID, viewAs: "incoming" })
                  }
                />
              </li>
            ))}
          </ul>
        )}

        <PaginationControls
          page={pendingPage}
          totalPages={pendingQuery.data?.pagination.totalPages ?? 1}
          onChange={setPendingPage}
        />
      </Card>

      <Card className="p-6">
        <DashboardWidgetHeader icon="📤" title="Outgoing Transfers" className="mb-4" />

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SelectField
            label="Type"
            value={ongoingStatusFilter}
            onChange={(v) => {
              setOngoingStatusFilter(v as OngoingStatusFilter);
              setOngoingPage(1);
            }}
            options={ONGOING_STATUS_OPTIONS}
          />
          <div>
            <label className={filterLabelClass} htmlFor="ongoing-shelter-name">
              Shelter Name
            </label>
            <input
              id="ongoing-shelter-name"
              placeholder="Search by Shelter Name"
              value={ongoingShelterName}
              onChange={(e) => {
                setOngoingShelterName(e.target.value);
                setOngoingPage(1);
              }}
              className={filterInputClass}
            />
          </div>
          <div>
            <label className={filterLabelClass} htmlFor="ongoing-pet-name">
              Pet Name
            </label>
            <input
              id="ongoing-pet-name"
              placeholder="Search by Pet Name"
              value={ongoingPetName}
              onChange={(e) => {
                setOngoingPetName(e.target.value);
                setOngoingPage(1);
              }}
              className={filterInputClass}
            />
          </div>
        </div>

        {ongoingQuery.isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {ongoingQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load ongoing transfers. Please try again.
          </p>
        )}
        {ongoingQuery.data && ongoingTransfers.length === 0 && (
          <DashboardEmptyMessage>
            No transfers match your filters.
          </DashboardEmptyMessage>
        )}

        {ongoingTransfers.length > 0 && (
          <ul className="flex flex-col gap-4">
            {ongoingTransfers.map((item) => (
              <li key={item.recordID}>
                <TransferRow
                  item={item}
                  onViewDetails={() =>
                    setDetail({ recordID: item.recordID, viewAs: "outgoing" })
                  }
                />
              </li>
            ))}
          </ul>
        )}

        <PaginationControls
          page={ongoingPage}
          totalPages={ongoingQuery.data?.pagination.totalPages ?? 1}
          onChange={setOngoingPage}
        />
      </Card>

      <TransferFormPanel
        open={transferForm !== null}
        presetPetID={transferForm?.presetPetID ?? null}
        onClose={() => setTransferForm(null)}
      />

      <TransferDetailPanel
        transferID={detail?.recordID ?? null}
        viewAs={detail?.viewAs ?? "incoming"}
        onClose={() => setDetail(null)}
      />
    </div>
  );
};

export default Transfers;
