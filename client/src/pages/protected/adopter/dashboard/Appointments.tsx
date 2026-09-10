import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FaPaw } from "react-icons/fa";
import Card from "../../../../components/ui/Card";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardWidgetHeader from "../../../../components/ui/dashboard/DashboardWidgetHeader";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import SelectField from "../../../../components/ui/SelectField";
import { getMyAppointments } from "../../../../logic/api/adoptersApi";
import AppointmentsList from "./shared/AppointmentsList";
import AppointmentDetailPanel from "./appointments/AppointmentDetailPanel";

type PetFilter = number | "all";

interface PetOption {
  petID: number;
  petName: string;
}

// A labelled "All pets" dropdown — the one filter appointments actually have
// data to support (there's no status field on the model).
const PetFilterSelect = ({
  options,
  value,
  onChange,
}: {
  options: PetOption[];
  value: PetFilter;
  onChange: (value: PetFilter) => void;
}) => (
  <SelectField
    label="Pet"
    icon={<FaPaw className="text-neutral-gray" />}
    className="max-w-xs"
    value={value === "all" ? "all" : String(value)}
    onChange={(v) => onChange(v === "all" ? "all" : Number(v))}
    options={[
      { value: "all", label: "All pets" },
      ...options.map((pet) => ({
        value: String(pet.petID),
        label: pet.petName,
      })),
    ]}
  />
);

// "Appointments" section of the adopter dashboard — upcoming and past vet
// visits. Rows open a detail slide-over; deep-linked via ?appointmentID from
// the Overview widget (read once on mount, then stripped).
const Appointments = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [openId, setOpenId] = useState<number | null>(() => {
    const id = Number(searchParams.get("appointmentID"));
    return Number.isInteger(id) && id > 0 ? id : null;
  });

  useEffect(() => {
    if (searchParams.has("appointmentID")) {
      searchParams.delete("appointmentID");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [upcomingPet, setUpcomingPet] = useState<PetFilter>("all");
  const [pastPet, setPastPet] = useState<PetFilter>("all");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["adopter", "appointments", "all"],
    queryFn: () => getMyAppointments(),
  });

  const appointments = useMemo(() => data ?? [], [data]);

  const petOptions = useMemo<PetOption[]>(() => {
    const seen = new Map<number, string>();
    appointments.forEach((a) => {
      if (!seen.has(a.pet.petID)) seen.set(a.pet.petID, a.pet.petName);
    });
    return [...seen.entries()]
      .map(([petID, petName]) => ({ petID, petName }))
      .sort((a, b) => a.petName.localeCompare(b.petName));
  }, [appointments]);

  const now = Date.now();
  // Endpoint orders ascending; show the most recent past appointment first.
  const upcoming = appointments.filter(
    (a) => new Date(a.appointmentDate).getTime() > now,
  );
  const past = appointments
    .filter((a) => new Date(a.appointmentDate).getTime() <= now)
    .reverse();

  const byPet = (pet: PetFilter) => (a: { pet: { petID: number } }) =>
    pet === "all" || a.pet.petID === pet;

  const filteredUpcoming = upcoming.filter(byPet(upcomingPet));
  const filteredPast = past.filter(byPet(pastPet));

  return (
    <div>
      <DashboardHeading
        title="Appointments"
        emoji="🗓️"
        message="Your upcoming and past vet visits"
      />

      {isLoading && (
        <p className="font-body text-sm text-neutral-gray">
          Loading your appointments…
        </p>
      )}

      {isError && (
        <p className="font-body text-sm text-rose-dark">
          Couldn't load your appointments. Please try again.
        </p>
      )}

      {data && appointments.length === 0 && (
        <div className="rounded-2xl bg-white p-10 text-center shadow-md">
          <DashboardEmptyMessage>
            No appointments yet. Your shelter's vet team will schedule these for
            pets you've adopted.
          </DashboardEmptyMessage>
        </div>
      )}

      {appointments.length > 0 && (
        <div className="flex flex-col gap-6">
          {/* Upcoming */}
          <Card className="p-6">
            <DashboardWidgetHeader icon="📝" title="Upcoming Appointments" />
            <div className="mb-4">
              <PetFilterSelect
                options={petOptions}
                value={upcomingPet}
                onChange={setUpcomingPet}
              />
            </div>
            {filteredUpcoming.length === 0 ? (
              <DashboardEmptyMessage>
                No upcoming appointments
                {upcomingPet !== "all" && " for this pet"}.
              </DashboardEmptyMessage>
            ) : (
              <AppointmentsList
                appointments={filteredUpcoming}
                onViewDetails={setOpenId}
                variant="upcoming"
              />
            )}
          </Card>

          {/* Past */}
          <Card className="p-6">
            <DashboardWidgetHeader icon="📁" title="Past Appointments" />
            <div className="mb-4">
              <PetFilterSelect
                options={petOptions}
                value={pastPet}
                onChange={setPastPet}
              />
            </div>
            {filteredPast.length === 0 ? (
              <DashboardEmptyMessage>
                No past appointments{pastPet !== "all" && " for this pet"}.
              </DashboardEmptyMessage>
            ) : (
              <AppointmentsList
                appointments={filteredPast}
                onViewDetails={setOpenId}
                variant="past"
              />
            )}
          </Card>
        </div>
      )}

      <AppointmentDetailPanel
        appointmentID={openId}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
};

export default Appointments;
