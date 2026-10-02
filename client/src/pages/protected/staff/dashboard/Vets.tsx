import { useState } from "react";
import { Navigate } from "react-router-dom";
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
} from "../../../../components/ui/dashboard/DashboardList";
import { getMyStaffProfile } from "../../../../logic/api/staffApi";
import {
  getShelterVets,
  type ShelterVet,
} from "../../../../logic/api/shelterVetsApi";
import VetDetailPanel from "./sections/vets/VetDetailPanel";
import VetApprovalPanel from "./sections/vets/VetApprovalPanel";
import { formatVetName } from "../../../../logic/utils/vetName";
import { approvalBlockers } from "../../../../logic/staff/approvalReadiness";

const PAGE_SIZE = 20;

type StatusFilter = "Active" | "Deactivated" | "all";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "Active", label: "Active" },
  { value: "Deactivated", label: "Deactivated" },
];

// Matches SelectField's own label + trigger sizing, same as Staff.tsx.
const filterInputClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark";
const filterLabelClass =
  "mb-1.5 block font-body text-sm font-semibold text-neutral-charcoal";

// Shared by both sections' rows: avatar | name + role | phone and email
// inline | actions — same layout as the Staff tab's rows.
const vetRowProps = (vet: ShelterVet) => ({
  leading: (
    <Avatar
      seed={vet.avatarSeed}
      alt={`${vet.vetName} avatar`}
      size={48}
      className="h-12 w-12 shrink-0 rounded-full ring-2 ring-teal-dark"
    />
  ),
  title: formatVetName(vet.vetName),
  lines: [{ text: "Veterinarian" }],
  details: (
    <>
      <span className="flex items-center gap-2">
        <span role="img" aria-label="Phone" className="shrink-0">
          ☎️
        </span>
        {vet.vetPhone ? <PhoneDisplay value={vet.vetPhone} /> : "No phone"}
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <span role="img" aria-label="Email" className="shrink-0">
          ✉️
        </span>
        <span className="truncate">{vet.vetEmail}</span>
      </span>
    </>
  ),
});

// Vets tab (Management → Vets) — the shelter manager's veterinarian roster,
// same structure as the Staff tab (Staff.tsx): Vet Approvals (Pending
// registrations at this shelter; each row shows what approval is waiting
// on, and "View Details" opens VetApprovalPanel — profile, onboarding and ID
// status, Approve/Decline) and All Vets (approved: Active or Deactivated,
// with status filter + name search; "View Details" opens VetDetailPanel,
// which also lets the manager deactivate an Active vet). Manager-only:
// everyone else is sent to /forbidden, and GET/PATCH /staff/me/vets 403
// them too.
const Vets = () => {
  const [viewing, setViewing] = useState<ShelterVet | null>(null);
  const [reviewing, setReviewing] = useState<ShelterVet | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["staff", "me"],
    queryFn: getMyStaffProfile,
  });
  const isManager = profile?.staffDesignation === "Manager";

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [name, setName] = useState("");

  const allQuery = useQuery({
    queryKey: ["staff", "vets", "all", { page, status, name }],
    queryFn: () =>
      getShelterVets({
        section: "all",
        accountStatus: status === "all" ? undefined : status,
        name: name.trim() || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    enabled: isManager,
    placeholderData: keepPreviousData,
  });
  const vets = allQuery.data?.data ?? [];

  const pendingQuery = useQuery({
    queryKey: ["staff", "vets", "pending"],
    queryFn: () => getShelterVets({ section: "pending", limit: 100 }),
    enabled: isManager,
  });
  const pendingVets = pendingQuery.data?.data ?? [];

  if (profile && !isManager) {
    return <Navigate to="/forbidden" replace />;
  }

  return (
    <div>
      <DashboardHeading
        title="Vets"
        emoji="🩺"
        message="Manage your shelter's veterinarians"
      />

      <Card className="mb-6 p-6">
        <DashboardWidgetHeader
          icon="🧑‍⚕️"
          title="Vet Approvals"
          className="mb-4"
        />

        {pendingQuery.isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {pendingQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load pending veterinarians. Please try again.
          </p>
        )}
        {pendingQuery.data && pendingVets.length === 0 && (
          <DashboardEmptyMessage>
            No veterinarians awaiting approval.
          </DashboardEmptyMessage>
        )}

        {pendingVets.length > 0 && (
          <ul className="flex flex-col gap-4">
            {pendingVets.map((vet) => {
              // Approval needs onboarding complete AND a Verified ID — shown
              // here at a glance; the panel has the details and the actions.
              const rowProps = vetRowProps(vet);
              const blockers = approvalBlockers(vet);
              return (
                <li key={vet.userID}>
                  <DashboardListRow
                    {...rowProps}
                    lines={[
                      ...rowProps.lines,
                      {
                        text:
                          blockers.length > 0
                            ? `Can't approve yet: ${blockers.join(" · ")}`
                            : "Ready to approve — onboarding done, ID verified",
                        strong: blockers.length === 0,
                      },
                    ]}
                    actions={
                      <RowActionButton onClick={() => setReviewing(vet)}>
                        View Details
                      </RowActionButton>
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="p-6">
        <DashboardWidgetHeader icon="🧑‍⚕️" title="All Vets" className="mb-4" />

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
            <label className={filterLabelClass} htmlFor="vet-name-search">
              Vet Name
            </label>
            <input
              id="vet-name-search"
              placeholder="Search by vet name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setPage(1);
              }}
              className={filterInputClass}
            />
          </div>
        </div>

        {(allQuery.isLoading || !profile) && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {allQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load veterinarians. Please try again.
          </p>
        )}
        {allQuery.data && vets.length === 0 && (
          <DashboardEmptyMessage>
            No veterinarians match your filters.
          </DashboardEmptyMessage>
        )}

        {vets.length > 0 && (
          <ul className="flex flex-col gap-4">
            {vets.map((vet) => (
              <li key={vet.userID}>
                <DashboardListRow
                  {...vetRowProps(vet)}
                  badge={
                    vet.accountStatus === "Deactivated"
                      ? { label: "Deactivated", tone: "gray" }
                      : undefined
                  }
                  actions={
                    <RowActionButton onClick={() => setViewing(vet)}>
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
          totalPages={allQuery.data?.pagination.totalPages ?? 1}
          onChange={setPage}
        />
      </Card>

      <VetDetailPanel vet={viewing} onClose={() => setViewing(null)} />
      <VetApprovalPanel vet={reviewing} onClose={() => setReviewing(null)} />
    </div>
  );
};

export default Vets;
