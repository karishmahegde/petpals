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
import { governmentIdTypeBadge } from "../../../../logic/staff/governmentIdUserType";
import GovernmentIdDetailPanel from "./GovernmentIdDetailPanel";
import PaginationControls from "../../../../components/ui/dashboard/PaginationControls";
import DashboardWidgetHeader from "../../../../components/ui/dashboard/DashboardWidgetHeader";
import { formatVetName } from "../../../../logic/utils/vetName";

const PAGE_SIZE = 20;

const STATUS_TONE: Record<GovernmentIdVerificationStatus, BadgeTone> = {
  Pending: "gold",
  Verified: "green",
  Rejected: "red",
};

const filterInputClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark";
const filterLabelClass =
  "mb-1.5 block font-body text-sm font-semibold text-neutral-charcoal";

export interface UserTypeOption {
  value: GovernmentIdUserType | "all";
  label: string;
}

const IdRow = ({
  item,
  showStatus,
  scope,
  onReview,
}: {
  item: GovernmentIdQueueItem;
  showStatus: boolean;
  scope: "staff" | "admin";
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
    title={
      item.userType === "Veterinarian"
        ? formatVetName(item.personName)
        : item.personName
    }
    lines={[
      { text: item.personEmail ?? "No email on file" },
      { text: item.idType },
    ]}
    badge={
      showStatus
        ? {
            label: item.verificationStatus,
            tone: STATUS_TONE[item.verificationStatus],
          }
        : governmentIdTypeBadge(item.userType, scope)
    }
    actions={
      <RowActionButton onClick={onReview}>
        {showStatus ? "View Details" : "Review"}
      </RowActionButton>
    }
  />
);

interface IdVerificationQueueProps {
  /** Namespaces the query keys per dashboard. */
  scope: "staff" | "admin";
  /** Page subtitle — who this reviewer's queue covers. */
  message: string;
  /** Type filter options — only the person types this reviewer sees. */
  userTypeOptions: UserTypeOption[];
}

// ID Verification tab body, shared by the Staff and Admin dashboards —
// Pending Verification / Reviewed sections, each with a userType filter +
// name search. Which IDs appear is decided server-side (Admin → Managers and
// Admins; a shelter's manager → its Staff, Vets, Volunteers, Adopters; other
// staff → Adopters and Volunteers); each dashboard's page passes the
// matching filter options. A row's "Review" opens GovernmentIdDetailPanel,
// which owns Verify/Reject.
const IdVerificationQueue = ({
  scope,
  message,
  userTypeOptions,
}: IdVerificationQueueProps) => {
  const [openId, setOpenId] = useState<number | null>(null);

  const [pendingPage, setPendingPage] = useState(1);
  const [pendingUserType, setPendingUserType] = useState("all");
  const [pendingName, setPendingName] = useState("");

  const pendingQuery = useQuery({
    queryKey: [
      scope,
      "government-ids-queue",
      "pending",
      { page: pendingPage, pendingUserType, pendingName },
    ],
    queryFn: () =>
      getGovernmentIdsQueue({
        section: "pending",
        userType:
          pendingUserType === "all"
            ? undefined
            : (pendingUserType as GovernmentIdUserType),
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
      scope,
      "government-ids-queue",
      "reviewed",
      { page: reviewedPage, reviewedUserType, reviewedName },
    ],
    queryFn: () =>
      getGovernmentIdsQueue({
        section: "reviewed",
        userType:
          reviewedUserType === "all"
            ? undefined
            : (reviewedUserType as GovernmentIdUserType),
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
      <DashboardHeading title="ID Verification" emoji="🪪" message={message} />

      <Card className="mb-6 p-6">
        <DashboardWidgetHeader
          icon="⏳"
          title="Pending Verification"
          className="mb-4"
        />

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Type"
            value={pendingUserType}
            onChange={(v) => {
              setPendingUserType(v);
              setPendingPage(1);
            }}
            options={userTypeOptions}
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
                  scope={scope}
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
        <DashboardWidgetHeader icon="📁" title="Reviewed" className="mb-4" />

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Type"
            value={reviewedUserType}
            onChange={(v) => {
              setReviewedUserType(v);
              setReviewedPage(1);
            }}
            options={userTypeOptions}
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
                  scope={scope}
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

      <GovernmentIdDetailPanel
        governmentIDID={openId}
        onClose={() => setOpenId(null)}
        scope={scope}
      />
    </div>
  );
};

export default IdVerificationQueue;
