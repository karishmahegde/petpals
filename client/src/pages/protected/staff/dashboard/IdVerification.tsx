import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import Card from "../../../../components/ui/Card";
import SelectField from "../../../../components/ui/SelectField";
import Avatar from "../../../../components/ui/Avatar";
import type { BadgeTone } from "../../../../components/ui/Badge";
import {
  DashboardListRow,
  RowActionButton,
} from "../../../../components/ui/dashboard/DashboardList";
import {
  getGovernmentIdsQueue,
  type GovernmentIdQueueItem,
  type GovernmentIdUserType,
  type GovernmentIdVerificationStatus,
} from "../../../../logic/api/staffGovernmentIdsApi";
import GovernmentIdDetailPanel from "./sections/idVerification/GovernmentIdDetailPanel";
import PaginationControls from "../../../../components/ui/dashboard/PaginationControls";

const PAGE_SIZE = 20;

const USER_TYPE_TONE: Record<GovernmentIdUserType, BadgeTone> = {
  Adopter: "teal",
  Volunteer: "rose",
};

const STATUS_TONE: Record<GovernmentIdVerificationStatus, BadgeTone> = {
  Pending: "gold",
  Verified: "green",
  Rejected: "red",
};

const filterInputClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark";
const filterLabelClass =
  "mb-1.5 block font-body text-sm font-semibold text-neutral-charcoal";

const USER_TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "Adopter", label: "Adopters" },
  { value: "Volunteer", label: "Volunteers" },
];

const IdRow = ({
  item,
  showStatus,
  onReview,
}: {
  item: GovernmentIdQueueItem;
  showStatus: boolean;
  onReview: () => void;
}) => (
  <DashboardListRow
    leading={
      <Avatar
        seed={item.personAvatarSeed ?? String(item.userID)}
        size={48}
        className="h-12 w-12 shrink-0 rounded-full ring-2 ring-teal-dark"
      />
    }
    title={item.personName}
    lines={[
      { text: item.personEmail ?? "No email on file" },
      { text: item.idType },
    ]}
    badge={
      showStatus
        ? { label: item.verificationStatus, tone: STATUS_TONE[item.verificationStatus] }
        : { label: item.userType, tone: USER_TYPE_TONE[item.userType] }
    }
    actions={
      <RowActionButton onClick={onReview}>
        {showStatus ? "View Details" : "Review"}
      </RowActionButton>
    }
  />
);

// ID Verification tab — Pending Verification / Reviewed sections, each with
// a userType filter + name search. A row's "Review" opens
// GovernmentIdDetailPanel, which owns Verify/Reject.
const IdVerification = () => {
  const [openId, setOpenId] = useState<number | null>(null);

  const [pendingPage, setPendingPage] = useState(1);
  const [pendingUserType, setPendingUserType] = useState("all");
  const [pendingName, setPendingName] = useState("");

  const pendingQuery = useQuery({
    queryKey: [
      "staff",
      "government-ids-queue",
      "pending",
      { page: pendingPage, pendingUserType, pendingName },
    ],
    queryFn: () =>
      getGovernmentIdsQueue({
        section: "pending",
        userType:
          pendingUserType === "all" ? undefined : (pendingUserType as GovernmentIdUserType),
        name: pendingName || undefined,
        page: pendingPage,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const [reviewedPage, setReviewedPage] = useState(1);
  const [reviewedUserType, setReviewedUserType] = useState("all");
  const [reviewedName, setReviewedName] = useState("");

  const reviewedQuery = useQuery({
    queryKey: [
      "staff",
      "government-ids-queue",
      "reviewed",
      { page: reviewedPage, reviewedUserType, reviewedName },
    ],
    queryFn: () =>
      getGovernmentIdsQueue({
        section: "reviewed",
        userType:
          reviewedUserType === "all" ? undefined : (reviewedUserType as GovernmentIdUserType),
        name: reviewedName || undefined,
        page: reviewedPage,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const pendingIds = pendingQuery.data?.data ?? [];
  const reviewedIds = reviewedQuery.data?.data ?? [];

  return (
    <div>
      <DashboardHeading
        title="ID Verification"
        emoji="🪪"
        message="Review government ID submissions from adopters and volunteers at your shelter"
      />

      <Card className="mb-6 p-6">
        <h2 className="mb-4 font-display text-xl text-neutral-dark">
          Pending Verification
        </h2>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Type"
            value={pendingUserType}
            onChange={(v) => {
              setPendingUserType(v);
              setPendingPage(1);
            }}
            options={USER_TYPE_OPTIONS}
          />
          <div>
            <label className={filterLabelClass} htmlFor="pending-name">
              Search by Name
            </label>
            <input
              id="pending-name"
              placeholder="Search by name"
              value={pendingName}
              onChange={(e) => {
                setPendingName(e.target.value);
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
            Couldn't load pending submissions. Please try again.
          </p>
        )}
        {pendingQuery.data && pendingIds.length === 0 && (
          <DashboardEmptyMessage>
            No government IDs are awaiting verification.
          </DashboardEmptyMessage>
        )}

        {pendingIds.length > 0 && (
          <ul className="flex flex-col gap-4">
            {pendingIds.map((item) => (
              <li key={item.governmentIDID}>
                <IdRow
                  item={item}
                  showStatus={false}
                  onReview={() => setOpenId(item.governmentIDID)}
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
        <h2 className="mb-4 font-display text-xl text-neutral-dark">Reviewed</h2>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Type"
            value={reviewedUserType}
            onChange={(v) => {
              setReviewedUserType(v);
              setReviewedPage(1);
            }}
            options={USER_TYPE_OPTIONS}
          />
          <div>
            <label className={filterLabelClass} htmlFor="reviewed-name">
              Search by Name
            </label>
            <input
              id="reviewed-name"
              placeholder="Search by name"
              value={reviewedName}
              onChange={(e) => {
                setReviewedName(e.target.value);
                setReviewedPage(1);
              }}
              className={filterInputClass}
            />
          </div>
        </div>

        {reviewedQuery.isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {reviewedQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load reviewed submissions. Please try again.
          </p>
        )}
        {reviewedQuery.data && reviewedIds.length === 0 && (
          <DashboardEmptyMessage>
            No government IDs match your filters.
          </DashboardEmptyMessage>
        )}

        {reviewedIds.length > 0 && (
          <ul className="flex flex-col gap-4">
            {reviewedIds.map((item) => (
              <li key={item.governmentIDID}>
                <IdRow
                  item={item}
                  showStatus
                  onReview={() => setOpenId(item.governmentIDID)}
                />
              </li>
            ))}
          </ul>
        )}

        <PaginationControls
          page={reviewedPage}
          totalPages={reviewedQuery.data?.pagination.totalPages ?? 1}
          onChange={setReviewedPage}
        />
      </Card>

      <GovernmentIdDetailPanel governmentIDID={openId} onClose={() => setOpenId(null)} />
    </div>
  );
};

export default IdVerification;
