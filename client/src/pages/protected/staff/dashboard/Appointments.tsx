import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FaPlus } from "react-icons/fa";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import Card from "../../../../components/ui/Card";
import SelectField from "../../../../components/ui/SelectField";
import type { BadgeTone } from "../../../../components/ui/Badge";
import {
  DashboardListRow,
  RowActionButton,
} from "../../../../components/ui/dashboard/DashboardList";
import {
  getAppointmentsQueue,
  getShelterVets,
  type AppointmentDetail,
  type AppointmentQueueItem,
  type AppointmentStatus,
} from "../../../../logic/api/staffAppointmentsApi";
import { formatTime } from "../../../../logic/utils/datetime";
import AppointmentFormPanel from "./sections/appointments/AppointmentFormPanel";
import AppointmentDetailPanel from "./sections/appointments/AppointmentDetailPanel";
import PaginationControls from "../../../../components/ui/dashboard/PaginationControls";

const PAGE_SIZE = 20;

const STATUS_TONE: Record<AppointmentStatus, BadgeTone> = {
  Scheduled: "gold",
  Completed: "green",
  Cancelled: "red",
};

const filterInputClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark";
const filterLabelClass =
  "mb-1.5 block font-body text-sm font-semibold text-neutral-charcoal";

const AppointmentRow = ({
  item,
  showStatus,
  onViewDetails,
}: {
  item: AppointmentQueueItem;
  showStatus: boolean;
  onViewDetails: () => void;
}) => {
  const when = new Date(item.appointmentDate);
  return (
    <DashboardListRow
      className={showStatus ? "bg-neutral-lightgray" : "bg-gold-lightest"}
      leading={
        <div className="w-12 shrink-0 text-center">
          <p className="font-body text-sm font-bold text-neutral-charcoal">
            {when.toLocaleDateString("en-US", { month: "short" })}
          </p>
          <p className="font-display text-3xl font-light text-neutral-charcoal">
            {when.getDate()}
          </p>
        </div>
      }
      title={`${item.pet.petName} - ${item.appointmentReason} | Dr. ${item.vetName}`}
      lines={[{ text: `${formatTime(when)} | ${item.appointmentReason}` }]}
      badge={showStatus ? { label: item.status, tone: STATUS_TONE[item.status] } : undefined}
      actions={<RowActionButton onClick={onViewDetails}>View Details</RowActionButton>}
    />
  );
};

// Appointments tab — Upcoming Appointments (Scheduled, still in the
// future) and Past Appointments (everything else — naturally past-dated or
// Cancelled), each with a Vet filter + pet-name search. "+ New Appointment"
// opens AppointmentFormPanel; a row's "View Details" opens
// AppointmentDetailPanel, which owns Cancel and Edit. Edit closes the detail
// panel and opens the same form in edit mode; closing the form (saved or
// not) returns to that appointment's detail panel.
type FormState = { mode: "create" } | { mode: "edit"; appointment: AppointmentDetail };

const Appointments = () => {
  const [formState, setFormState] = useState<FormState | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  const closeForm = () => {
    if (formState?.mode === "edit") setOpenId(formState.appointment.appointmentID);
    setFormState(null);
  };

  const { data: vets = [] } = useQuery({
    queryKey: ["staff", "shelter-vets"],
    queryFn: getShelterVets,
  });
  const vetOptions = [
    { value: "all", label: "All Vets" },
    ...vets.map((v) => ({ value: String(v.vetID), label: v.vetName })),
  ];

  const [upcomingPage, setUpcomingPage] = useState(1);
  const [upcomingVet, setUpcomingVet] = useState("all");
  const [upcomingPetName, setUpcomingPetName] = useState("");

  const upcomingQuery = useQuery({
    queryKey: [
      "staff",
      "appointments-queue",
      "upcoming",
      { page: upcomingPage, upcomingVet, upcomingPetName },
    ],
    queryFn: () =>
      getAppointmentsQueue({
        upcoming: true,
        vetID: upcomingVet === "all" ? undefined : Number(upcomingVet),
        petName: upcomingPetName || undefined,
        page: upcomingPage,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const [pastPage, setPastPage] = useState(1);
  const [pastVet, setPastVet] = useState("all");
  const [pastPetName, setPastPetName] = useState("");

  const pastQuery = useQuery({
    queryKey: [
      "staff",
      "appointments-queue",
      "past",
      { page: pastPage, pastVet, pastPetName },
    ],
    queryFn: () =>
      getAppointmentsQueue({
        upcoming: false,
        vetID: pastVet === "all" ? undefined : Number(pastVet),
        petName: pastPetName || undefined,
        page: pastPage,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const upcomingAppointments = upcomingQuery.data?.data ?? [];
  const pastAppointments = pastQuery.data?.data ?? [];

  return (
    <div>
      <DashboardHeading
        title="Appointments"
        emoji="🩺"
        message="Manage vet appointments at your shelter"
        action={{
          label: "New Appointment",
          icon: <FaPlus aria-hidden />,
          onClick: () => setFormState({ mode: "create" }),
        }}
      />

      <Card className="mb-6 p-6">
        <h2 className="mb-4 font-display text-xl text-neutral-dark">
          Upcoming Appointments
        </h2>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Vet"
            value={upcomingVet}
            onChange={(v) => {
              setUpcomingVet(v);
              setUpcomingPage(1);
            }}
            options={vetOptions}
          />
          <div>
            <label className={filterLabelClass} htmlFor="upcoming-pet-name">
              Pet Name
            </label>
            <input
              id="upcoming-pet-name"
              placeholder="Search by pet name"
              value={upcomingPetName}
              onChange={(e) => {
                setUpcomingPetName(e.target.value);
                setUpcomingPage(1);
              }}
              className={filterInputClass}
            />
          </div>
        </div>

        {upcomingQuery.isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {upcomingQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load upcoming appointments. Please try again.
          </p>
        )}
        {upcomingQuery.data && upcomingAppointments.length === 0 && (
          <DashboardEmptyMessage>
            No upcoming appointments scheduled.
          </DashboardEmptyMessage>
        )}

        {upcomingAppointments.length > 0 && (
          <ul className="flex flex-col gap-4">
            {upcomingAppointments.map((item) => (
              <li key={item.appointmentID}>
                <AppointmentRow
                  item={item}
                  showStatus={false}
                  onViewDetails={() => setOpenId(item.appointmentID)}
                />
              </li>
            ))}
          </ul>
        )}

        <PaginationControls
          page={upcomingPage}
          totalPages={upcomingQuery.data?.pagination.totalPages ?? 1}
          onChange={setUpcomingPage}
        />
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 font-display text-xl text-neutral-dark">
          Past Appointments
        </h2>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Vet"
            value={pastVet}
            onChange={(v) => {
              setPastVet(v);
              setPastPage(1);
            }}
            options={vetOptions}
          />
          <div>
            <label className={filterLabelClass} htmlFor="past-pet-name">
              Pet Name
            </label>
            <input
              id="past-pet-name"
              placeholder="Search by pet name"
              value={pastPetName}
              onChange={(e) => {
                setPastPetName(e.target.value);
                setPastPage(1);
              }}
              className={filterInputClass}
            />
          </div>
        </div>

        {pastQuery.isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {pastQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load past appointments. Please try again.
          </p>
        )}
        {pastQuery.data && pastAppointments.length === 0 && (
          <DashboardEmptyMessage>
            No past appointments match your filters.
          </DashboardEmptyMessage>
        )}

        {pastAppointments.length > 0 && (
          <ul className="flex flex-col gap-4">
            {pastAppointments.map((item) => (
              <li key={item.appointmentID}>
                <AppointmentRow
                  item={item}
                  showStatus
                  onViewDetails={() => setOpenId(item.appointmentID)}
                />
              </li>
            ))}
          </ul>
        )}

        <PaginationControls
          page={pastPage}
          totalPages={pastQuery.data?.pagination.totalPages ?? 1}
          onChange={setPastPage}
        />
      </Card>

      {/* key remounts the form per target, so it seeds fresh from `appointment`. */}
      <AppointmentFormPanel
        key={formState?.mode === "edit" ? formState.appointment.appointmentID : "create"}
        open={formState !== null}
        appointment={formState?.mode === "edit" ? formState.appointment : null}
        onClose={closeForm}
      />

      <AppointmentDetailPanel
        appointmentID={openId}
        onClose={() => setOpenId(null)}
        onEdit={(appointment) => {
          setOpenId(null);
          setFormState({ mode: "edit", appointment });
        }}
      />
    </div>
  );
};

export default Appointments;
