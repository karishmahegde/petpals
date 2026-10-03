import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardWidgetHeader from "../../../../components/ui/dashboard/DashboardWidgetHeader";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import PaginationControls from "../../../../components/ui/dashboard/PaginationControls";
import { DashboardListRow } from "../../../../components/ui/dashboard/DashboardList";
import Card from "../../../../components/ui/Card";
import type { BadgeTone } from "../../../../components/ui/Badge";
import type {
  AppointmentQueueItem,
  AppointmentStatus,
} from "../../../../logic/api/staffAppointmentsApi";
import { getMyVolunteerAppointments } from "../../../../logic/api/volunteersApi";
import { formatTime } from "../../../../logic/utils/datetime";
import { formatVetName } from "../../../../logic/utils/vetName";
import DateBlock from "./shared/DateBlock";

const PAGE_SIZE = 20;

const STATUS_TONE: Record<AppointmentStatus, BadgeTone> = {
  Scheduled: "gold",
  Completed: "green",
  Cancelled: "red",
};

const AppointmentRow = ({
  item,
  variant,
}: {
  item: AppointmentQueueItem;
  variant: "upcoming" | "past";
}) => (
  <DashboardListRow
    className={variant === "upcoming" ? "bg-rose-lightest" : "bg-neutral-lightgray"}
    leading={<DateBlock iso={item.appointmentDate} />}
    title={`${item.pet.petName} - ${item.appointmentReason}`}
    lines={[
      {
        text: `${formatTime(new Date(item.appointmentDate))} · ${item.pet.speciesName} · ${
          item.pet.breedName
        }`,
      },
      { text: `With ${formatVetName(item.vetName)}` },
    ]}
    badge={
      variant === "past"
        ? { label: item.status, tone: STATUS_TONE[item.status] }
        : undefined
    }
  />
);

// Appointments tab (/volunteer/appointments) — the vet appointments staff
// have assigned this volunteer to assist (GET /volunteers/me/appointments),
// read-only, as two cards like the vet Appointments tab: Upcoming
// (Scheduled and still ahead, soonest first) and Past (already happened or
// Cancelled, most recent first). Each paginates on its own.
const Appointments = () => {
  const [upcomingPage, setUpcomingPage] = useState(1);
  const upcomingQuery = useQuery({
    queryKey: ["volunteer", "appointments", "upcoming", { page: upcomingPage }],
    queryFn: () =>
      getMyVolunteerAppointments({ upcoming: true, page: upcomingPage, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const [pastPage, setPastPage] = useState(1);
  const pastQuery = useQuery({
    queryKey: ["volunteer", "appointments", "past", { page: pastPage }],
    queryFn: () =>
      getMyVolunteerAppointments({ upcoming: false, page: pastPage, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const upcoming = upcomingQuery.data?.data ?? [];
  const past = pastQuery.data?.data ?? [];

  return (
    <div>
      <DashboardHeading
        title="Appointments"
        emoji="🩺"
        message="Vet appointments you're assisting with"
        showDate
      />

      <Card className="mb-6 p-6">
        <DashboardWidgetHeader icon="🗓️" title="Upcoming Appointments" className="mb-4" />

        {upcomingQuery.isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {upcomingQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load upcoming appointments. Please try again.
          </p>
        )}
        {upcomingQuery.data && upcoming.length === 0 && (
          <DashboardEmptyMessage>
            No upcoming appointments — staff will assign you when a vet needs help.
          </DashboardEmptyMessage>
        )}

        {upcoming.length > 0 && (
          <ul className="flex flex-col gap-4">
            {upcoming.map((item) => (
              <li key={item.appointmentID}>
                <AppointmentRow item={item} variant="upcoming" />
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
        <DashboardWidgetHeader icon="📁" title="Past Appointments" className="mb-4" />

        {pastQuery.isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {pastQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load past appointments. Please try again.
          </p>
        )}
        {pastQuery.data && past.length === 0 && (
          <DashboardEmptyMessage>No past appointments yet.</DashboardEmptyMessage>
        )}

        {past.length > 0 && (
          <ul className="flex flex-col gap-4">
            {past.map((item) => (
              <li key={item.appointmentID}>
                <AppointmentRow item={item} variant="past" />
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
    </div>
  );
};

export default Appointments;
