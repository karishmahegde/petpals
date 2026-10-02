// useTodaysAppointments.ts
// Every one of the vet's appointments today, earliest first — shared by the
// Today's Appointments tile and widget on the vet Overview.
// GET /vets/me/appointments splits at "now" (upcoming = still in the future;
// past = already started, or Cancelled) and has no date-range param, so
// this reads both halves and keeps today's — one that started an hour ago
// is still today's. Cancelled ones are left out.
// Keys sit under ["vet", "appointments"], so completing an appointment or
// recording a dose (which invalidate that prefix) refreshes them too.
import { useQuery } from "@tanstack/react-query";
import { getMyVetAppointments } from "../../../../../logic/api/vetsApi";
import { isToday } from "../../../../../logic/utils/datetime";

// Large enough to cover a vet's queue either side of today without paging.
const FETCH_LIMIT = 100;

const useTodaysAppointments = () => {
  const upcoming = useQuery({
    queryKey: ["vet", "appointments", { upcoming: true, limit: FETCH_LIMIT }],
    queryFn: () => getMyVetAppointments({ upcoming: true, limit: FETCH_LIMIT }),
  });
  const past = useQuery({
    queryKey: ["vet", "appointments", { upcoming: false, limit: FETCH_LIMIT }],
    queryFn: () => getMyVetAppointments({ upcoming: false, limit: FETCH_LIMIT }),
  });

  const appointments = [...(past.data?.data ?? []), ...(upcoming.data?.data ?? [])]
    .filter((a) => a.status !== "Cancelled" && isToday(a.appointmentDate))
    .sort(
      (a, b) =>
        new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime(),
    );

  return {
    appointments,
    isLoading: upcoming.isLoading || past.isLoading,
    isReady: upcoming.isSuccess && past.isSuccess,
  };
};

export default useTodaysAppointments;
