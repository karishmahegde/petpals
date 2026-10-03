import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PiCalendarBlank, PiFunnel, PiMagnifyingGlass } from "react-icons/pi";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardWidgetHeader from "../../../../components/ui/dashboard/DashboardWidgetHeader";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import PaginationControls from "../../../../components/ui/dashboard/PaginationControls";
import Card from "../../../../components/ui/Card";
import SelectField from "../../../../components/ui/SelectField";
import type { BadgeTone } from "../../../../components/ui/Badge";
import {
  DashboardListRow,
  RowActionButton,
} from "../../../../components/ui/dashboard/DashboardList";
import type {
  AppointmentQueueItem,
  AppointmentStatus,
} from "../../../../logic/api/staffAppointmentsApi";
import { getMyVetAppointments } from "../../../../logic/api/vetsApi";
import { endOfDayISO, formatShortDate, formatTime } from "../../../../logic/utils/datetime";
import AppointmentDetailPanel from "./sections/appointments/AppointmentDetailPanel";

const PAGE_SIZE = 20;

const STATUS_TONE: Record<AppointmentStatus, BadgeTone> = {
  Scheduled: "gold",
  Completed: "green",
  Cancelled: "red",
};

// Upcoming-only date ranges, worked out in the vet's own timezone and sent
// as dateTo (the upcoming half already starts at "now").
type DateRange = "all" | "today" | "week" | "month";

const DATE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "all", label: "All Dates" },
  { value: "today", label: "Today" },
  { value: "week", label: "Next 7 days" },
  { value: "month", label: "Next 30 days" },
];

const DAYS_AHEAD: Record<Exclude<DateRange, "all">, number> = {
  today: 0,
  week: 7,
  month: 30,
};

const searchInputClass =
  "w-full rounded-full border border-neutral-lightgray bg-white py-2.5 pl-4 pr-10 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark";
const filterLabelClass =
  "mb-1.5 flex items-center gap-1.5 font-body text-sm font-semibold text-neutral-charcoal";

// Upcoming rows lead with the time (the date is in the line below); past
// rows lead with the date and carry a status badge (Completed/Cancelled).
const AppointmentRow = ({
  item,
  variant,
  onViewDetails,
}: {
  item: AppointmentQueueItem;
  variant: "upcoming" | "past";
  onViewDetails: () => void;
}) => {
  const when = new Date(item.appointmentDate);
  const [time, meridiem] = formatTime(when).split(" ");
  const petLine = `${item.pet.speciesName} · ${item.pet.breedName}`;

  return (
    <DashboardListRow
      className={variant === "upcoming" ? "bg-gold-lightest" : "bg-neutral-lightgray"}
      leading={
        variant === "upcoming" ? (
          <div className="w-14 shrink-0 text-center">
            <p className="font-body text-sm font-bold text-neutral-charcoal">{time}</p>
            <p className="font-body text-xs text-neutral-gray">{meridiem}</p>
          </div>
        ) : (
          <div className="w-16 shrink-0">
            <p className="font-body text-sm font-bold text-neutral-charcoal">
              {when.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </p>
            <p className="font-body text-sm font-bold text-neutral-charcoal">
              {when.getFullYear()}
            </p>
          </div>
        )
      }
      title={`${item.pet.petName} - ${item.appointmentReason}`}
      lines={[
        {
          text:
            variant === "upcoming"
              ? `${formatShortDate(when)} · ${petLine}`
              : `${formatTime(when)} · ${petLine}`,
        },
      ]}
      badge={
        variant === "past"
          ? { label: item.status, tone: STATUS_TONE[item.status] }
          : undefined
      }
      actions={<RowActionButton onClick={onViewDetails}>View Details</RowActionButton>}
    />
  );
};

// Appointments tab (/vet/appointments) — the vet's own queue, as two cards:
// Upcoming (Scheduled and still ahead, soonest first; Filters box with a
// date range and pet-name search) and Past (already happened or
// Cancelled, most recent first). Each paginates on its own. "View Details"
// opens AppointmentDetailPanel — notes, vaccinations, Complete.
const Appointments = () => {
  const [openId, setOpenId] = useState<number | null>(null);

  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [petName, setPetName] = useState("");
  const [upcomingPage, setUpcomingPage] = useState(1);

  const upcomingQuery = useQuery({
    queryKey: ["vet", "appointments", "upcoming", { dateRange, petName, page: upcomingPage }],
    queryFn: () =>
      getMyVetAppointments({
        upcoming: true,
        petName: petName.trim() || undefined,
        dateTo: dateRange === "all" ? undefined : endOfDayISO(DAYS_AHEAD[dateRange]),
        page: upcomingPage,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const [pastPage, setPastPage] = useState(1);
  const pastQuery = useQuery({
    queryKey: ["vet", "appointments", "past", { page: pastPage }],
    queryFn: () =>
      getMyVetAppointments({ upcoming: false, page: pastPage, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const upcoming = upcomingQuery.data?.data ?? [];
  const past = pastQuery.data?.data ?? [];

  return (
    <div>
      <DashboardHeading
        title="Appointments"
        emoji="🩺"
        message="Manage your patient appointments"
        showDate
      />

      <Card className="mb-6 p-6">
        <DashboardWidgetHeader icon="🗓️" title="Upcoming Appointments" className="mb-4" />

        <div className="mb-5 rounded-2xl border border-neutral-lightgray p-4">
          <p className="mb-3 flex items-center gap-1.5 font-body text-base font-semibold text-neutral-dark">
            <PiFunnel aria-hidden /> Filters
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="Appointment Date"
              icon={<PiCalendarBlank className="text-neutral-gray" />}
              value={dateRange}
              onChange={(v) => {
                setDateRange(v as DateRange);
                setUpcomingPage(1);
              }}
              options={DATE_OPTIONS}
            />
            <div>
              <label className={filterLabelClass} htmlFor="vet-appt-pet-name">
                <PiMagnifyingGlass aria-hidden /> Search by pet name
              </label>
              <div className="relative">
                <input
                  id="vet-appt-pet-name"
                  placeholder="Pet Name"
                  value={petName}
                  onChange={(e) => {
                    setPetName(e.target.value);
                    setUpcomingPage(1);
                  }}
                  className={searchInputClass}
                />
                <PiMagnifyingGlass
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-neutral-gray"
                  aria-hidden
                />
              </div>
            </div>
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
        {upcomingQuery.data && upcoming.length === 0 && (
          <DashboardEmptyMessage>
            {dateRange === "all" && !petName.trim()
              ? "No upcoming appointments."
              : "No upcoming appointments match your filters."}
          </DashboardEmptyMessage>
        )}

        {upcoming.length > 0 && (
          <ul className="flex flex-col gap-4">
            {upcoming.map((item) => (
              <li key={item.appointmentID}>
                <AppointmentRow
                  item={item}
                  variant="upcoming"
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
                <AppointmentRow
                  item={item}
                  variant="past"
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

      <AppointmentDetailPanel
        appointmentID={openId}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
};

export default Appointments;
