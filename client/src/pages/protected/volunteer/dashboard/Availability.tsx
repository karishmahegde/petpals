import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardWidgetHeader from "../../../../components/ui/dashboard/DashboardWidgetHeader";
import Card from "../../../../components/ui/Card";
import ButtonElement from "../../../../components/ui/ButtonElement";
import AvailabilityGrid from "../../../../components/ui/AvailabilityGrid";
import {
  getMyVolunteerProfile,
  updateMyVolunteerAvailability,
} from "../../../../logic/api/volunteersApi";
import {
  AVAILABILITY_DAYS,
  AVAILABILITY_SLOTS,
  isAvailable,
  type Availability as AvailabilityValue,
  type AvailabilityDay,
  type AvailabilitySlot,
} from "../../../../logic/utils/availability";

const EMPTY: AvailabilityValue = {};

// One slot flipped, as a new object — slots kept in Morning → Evening order
// and a day with none left dropped, so the saved form matches the server's.
const toggleSlot = (
  value: AvailabilityValue,
  day: AvailabilityDay,
  slot: AvailabilitySlot,
): AvailabilityValue => {
  const current = value[day] ?? [];
  const nextSlots = AVAILABILITY_SLOTS.filter((s) =>
    s === slot ? !current.includes(s) : current.includes(s),
  );
  const next = { ...value, [day]: nextSlots };
  if (nextSlots.length === 0) delete next[day];
  return next;
};

const sameAvailability = (a: AvailabilityValue, b: AvailabilityValue) =>
  AVAILABILITY_DAYS.every((day) =>
    AVAILABILITY_SLOTS.every((slot) => isAvailable(a, day, slot) === isAvailable(b, day, slot)),
  );

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Couldn't save your availability. Please try again.";

// Availability tab (/volunteer/availability) — the volunteer's weekly
// availability as a Mon–Sun × Morning/Afternoon/Evening grid of toggles
// (shared AvailabilityGrid, read-only on staff's volunteer detail). Edits
// stay local until Save, which replaces the whole week (PUT
// /volunteers/me/availability). A schedule stored as older free text
// (availability null) is shown above an empty grid; saving replaces it.
const Availability = () => {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    queryKey: ["volunteer", "me"],
    queryFn: getMyVolunteerProfile,
  });
  const profile = profileQuery.data;
  const saved = profile?.availability ?? EMPTY;

  // null = untouched, so the grid follows the saved value.
  const [draft, setDraft] = useState<AvailabilityValue | null>(null);
  const shown = draft ?? saved;
  const isDirty = draft !== null && !sameAvailability(draft, saved);

  const mutation = useMutation({
    mutationFn: updateMyVolunteerAvailability,
    onSuccess: (updated) => {
      queryClient.setQueryData(["volunteer", "me"], updated);
      setDraft(null);
      toast.success("Availability saved");
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const legacySchedule =
    profile && profile.availability === null && profile.volunteerSchedule
      ? profile.volunteerSchedule
      : null;

  return (
    <div className="mx-auto max-w-3xl">
      <DashboardHeading
        title="Availability"
        emoji="🗓️"
        message="Let your shelter know when you can help"
      />

      {profileQuery.isLoading && (
        <p className="font-body text-sm text-neutral-gray">Loading…</p>
      )}
      {profileQuery.isError && (
        <p className="font-body text-sm text-rose-dark">
          Couldn't load your availability. Please try again.
        </p>
      )}

      {profile && (
        <Card className="p-6">
          <DashboardWidgetHeader icon="🕒" title="Weekly Availability" className="mb-2" />
          <p className="mb-5 font-body text-sm text-neutral-gray">
            Tap a slot to switch it on or off — staff see this when they assign tasks,
            events and appointments.
          </p>

          {legacySchedule && (
            <p className="mb-5 rounded-lg bg-gold-lightest px-4 py-2 font-body text-sm text-neutral-charcoal">
              Your current schedule was saved as text: <strong>{legacySchedule}</strong>.
              Pick your slots below and save to replace it.
            </p>
          )}

          <AvailabilityGrid
            value={shown}
            onToggle={(day, slot) => setDraft(toggleSlot(shown, day, slot))}
            disabled={mutation.isPending}
          />

          <div className="mt-6 flex justify-end gap-3">
            <ButtonElement
              onClick={() => setDraft(null)}
              disabled={!isDirty || mutation.isPending}
              size="bare"
              className="rounded-xl bg-red px-5 py-2 text-sm font-medium hover:brightness-95 disabled:opacity-50"
            >
              Discard changes
            </ButtonElement>
            <ButtonElement
              onClick={() => mutation.mutate(shown)}
              disabled={!isDirty || mutation.isPending}
              size="bare"
              className="rounded-xl bg-teal-dark px-5 py-2 text-sm font-medium hover:brightness-95 disabled:opacity-50"
            >
              {mutation.isPending ? "Saving…" : "Save"}
            </ButtonElement>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Availability;
