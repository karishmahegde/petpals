import { useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import toast from "react-hot-toast";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import Card from "../../../../components/ui/Card";
import SelectField from "../../../../components/ui/SelectField";
import PhoneDisplay from "../../../../components/ui/PhoneDisplay";
import {
  DashboardActionList,
  DashboardListRow,
  RowActionButton,
  type RowLine,
} from "../../../../components/ui/dashboard/DashboardList";
import {
  getVolunteers,
  updateVolunteerStatus,
  type VolunteerAccountStatus,
  type VolunteerListItem,
} from "../../../../logic/api/volunteersApi";
import { VOLUNTEER_STATUS_TONE } from "../../../../logic/staff/volunteerStatus";
import VolunteerDetailPanel from "./sections/volunteers/VolunteerDetailPanel";
import PaginationControls from "../../../../components/ui/dashboard/PaginationControls";

const PAGE_SIZE = 20;

type StatusFilter = VolunteerAccountStatus | "all";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "Pending", label: "Pending" },
  { value: "Active", label: "Active" },
  { value: "Banned", label: "Banned" },
  { value: "Deactivated", label: "Deactivated" },
];

// Matches SelectField's own label + trigger sizing, same as Transfers.tsx.
const filterInputClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark";
const filterLabelClass =
  "mb-1.5 block font-body text-sm font-semibold text-neutral-charcoal";
const sectionHeadingClass =
  "mb-4 flex items-center gap-2 font-display text-2xl text-neutral-dark";

const contactLines = (volunteer: VolunteerListItem): RowLine[] => [
  {
    text: volunteer.volunteerPhone ? (
      <PhoneDisplay value={volunteer.volunteerPhone} />
    ) : (
      "No phone"
    ),
  },
  { text: volunteer.volunteerEmail },
];

// Volunteers tab — Volunteer Approvals (Pending registrations at this
// shelter; Approve inline, Decline behind a confirm via DashboardActionList)
// and All Volunteers (status filter + name search, paginated), whose rows
// open VolunteerDetailPanel. Both lists are GET /volunteers, scoped
// server-side to the caller's shelter.
const Volunteers = () => {
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<number | null>(null);

  const pendingQuery = useQuery({
    queryKey: ["staff", "volunteers", "pending"],
    queryFn: () => getVolunteers({ accountStatus: "Pending", limit: 100 }),
  });
  const pendingVolunteers = pendingQuery.data?.data ?? [];

  const approve = useMutation({
    mutationFn: (userID: number) => updateVolunteerStatus(userID, "Active"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "volunteers"] });
      toast.success("Volunteer approved");
    },
    onError: () => toast.error("Couldn't approve this volunteer. Please try again."),
  });

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [name, setName] = useState("");

  const listQuery = useQuery({
    queryKey: ["staff", "volunteers", "list", { page, statusFilter, name }],
    queryFn: () =>
      getVolunteers({
        accountStatus: statusFilter === "all" ? undefined : statusFilter,
        name: name || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });
  const volunteers = listQuery.data?.data ?? [];

  return (
    <div>
      <DashboardHeading
        title="Volunteers"
        emoji="🙌"
        message="Manage volunteers at your shelter"
      />

      <Card className="mb-6 p-6">
        <h2 className={sectionHeadingClass}>🧑‍💼 Volunteer Approvals</h2>

        {pendingQuery.isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {pendingQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load pending volunteers. Please try again.
          </p>
        )}
        {pendingQuery.data && pendingVolunteers.length === 0 && (
          <DashboardEmptyMessage>No volunteers awaiting approval.</DashboardEmptyMessage>
        )}

        {pendingVolunteers.length > 0 && (
          <DashboardActionList
            items={pendingVolunteers}
            getKey={(volunteer) => volunteer.userID}
            renderRow={(volunteer, confirm) => (
              <DashboardListRow
                title={volunteer.volunteerName}
                lines={contactLines(volunteer)}
                actions={
                  <>
                    <RowActionButton
                      variant="success"
                      disabled={approve.isPending}
                      onClick={() => approve.mutate(volunteer.userID)}
                    >
                      Approve
                    </RowActionButton>
                    <RowActionButton
                      variant="danger"
                      onClick={() => confirm(volunteer)}
                    >
                      Decline
                    </RowActionButton>
                  </>
                }
              />
            )}
            confirmAction={{
              mutationFn: (volunteer) =>
                updateVolunteerStatus(volunteer.userID, "Deactivated"),
              invalidateKeys: [["staff", "volunteers"]],
              successToast: "Volunteer declined",
              errorToast: "Couldn't decline this volunteer. Please try again.",
              modalTitle: "Decline this volunteer?",
              confirmLabel: "Decline",
              renderBody: (volunteer) => (
                <>
                  This declines {volunteer.volunteerName}'s registration and
                  deactivates their account.
                </>
              ),
            }}
          />
        )}
      </Card>

      <Card className="p-6">
        <h2 className={sectionHeadingClass}>🧑‍💼 All Volunteers</h2>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Account Status"
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v as StatusFilter);
              setPage(1);
            }}
            options={STATUS_OPTIONS}
          />
          <div>
            <label className={filterLabelClass} htmlFor="volunteer-name">
              Volunteer Name
            </label>
            <input
              id="volunteer-name"
              placeholder="Search by volunteer name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setPage(1);
              }}
              className={filterInputClass}
            />
          </div>
        </div>

        {listQuery.isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {listQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load volunteers. Please try again.
          </p>
        )}
        {listQuery.data && volunteers.length === 0 && (
          <DashboardEmptyMessage>No volunteers match your filters.</DashboardEmptyMessage>
        )}

        {volunteers.length > 0 && (
          <ul className="flex flex-col gap-4">
            {volunteers.map((volunteer) => (
              <li key={volunteer.userID}>
                <DashboardListRow
                  title={volunteer.volunteerName}
                  lines={contactLines(volunteer)}
                  badge={{
                    label: volunteer.accountStatus,
                    tone: VOLUNTEER_STATUS_TONE[volunteer.accountStatus],
                  }}
                  actions={
                    <RowActionButton onClick={() => setOpenId(volunteer.userID)}>
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
          totalPages={listQuery.data?.pagination.totalPages ?? 1}
          onChange={setPage}
        />
      </Card>

      <VolunteerDetailPanel userID={openId} onClose={() => setOpenId(null)} />
    </div>
  );
};

export default Volunteers;
