// StatsWidget.tsx
// KPI row at the top of the staff Overview page — mirrors Admin's
// StatsWidget (same Card + StatTile pattern). All four tiles are wired to
// real data. Every value falls back to "—" only while loading (via `??`,
// not `||`) — a genuine 0 always renders as 0, never "—".
//   - Pets: total pet records at the shelter, any adoptionStatus — not a
//     current/capacity fraction (that would need shelterSize, which GET
//     /staff/me doesn't return, and the endpoint that does, GET
//     /analytics/shelters, is Admin-only).
//   - Visits Today: GET /visits (Sprint 5.2) has no date-range filter, so
//     the tile fetches the shelter's queue and counts today's visits
//     client-side — see TodaysVisitsWidget's isToday helper for the same
//     logic, kept local to each file since it's a one-liner.
//   - Pending Transfers: the Transfers domain has no backend at all yet, so
//     this is a proxy — pets at this shelter whose adoptionStatus is
//     already 'transferred' (GET /staff/me/pets?adoptionStatus=transferred),
//     not a real in-flight-transfer count.
import { useQuery } from "@tanstack/react-query";
import {
  PiPawPrintBold,
  PiCalendarCheckBold,
  PiClipboardTextBold,
  PiArrowsClockwiseBold,
} from "react-icons/pi";
import Card from "../../../../../../components/ui/Card";
import StatTile from "../../../../../../components/ui/dashboard/StatTile";
import { getApplicationsQueue } from "../../../../../../logic/api/adoptionApplicationsApi";
import { getVisitsQueue } from "../../../../../../logic/api/visitsApi";
import { getMyShelterPets } from "../../../../../../logic/api/staffPetsApi";

// Large enough to cover a single shelter's full day without paginating.
const VISITS_FETCH_LIMIT = 100;

const isToday = (isoDateTime: string) => {
  const date = new Date(isoDateTime);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
};

const StatsWidget = () => {
  const { data: petsData } = useQuery({
    queryKey: ["staff", "shelter-pets", { limit: 1 }],
    // limit: 1, no adoptionStatus filter — this tile only needs
    // pagination.total across every status, not the rows.
    queryFn: () => getMyShelterPets({ limit: 1 }),
  });

  const { data: transfersData } = useQuery({
    queryKey: ["staff", "shelter-pets", { adoptionStatus: "transferred", limit: 1 }],
    queryFn: () =>
      getMyShelterPets({ adoptionStatus: "transferred", limit: 1 }),
  });

  const { data } = useQuery({
    queryKey: ["staff", "applications-queue", { status: "Pending", limit: 1 }],
    // limit: 1 — this tile only needs pagination.total, not the rows.
    queryFn: () => getApplicationsQueue({ status: "Pending", limit: 1 }),
  });

  const { data: visitsData } = useQuery({
    queryKey: ["staff", "visits-queue", { limit: VISITS_FETCH_LIMIT }],
    queryFn: () => getVisitsQueue({ limit: VISITS_FETCH_LIMIT }),
  });
  const visitsToday = visitsData?.data.filter((visit) =>
    isToday(visit.visitTime),
  ).length;

  return (
    <Card className="p-4 sm:p-6">
      <div className="grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:gap-5">
        <StatTile
          icon={<PiPawPrintBold />}
          value={petsData?.pagination.total ?? "—"}
          label="Pets"
          color="gold"
        />
        <StatTile
          icon={<PiCalendarCheckBold />}
          value={visitsToday ?? "—"}
          label="Visits Today"
          color="teal"
        />
        <StatTile
          icon={<PiClipboardTextBold />}
          value={data?.pagination.total ?? "—"}
          label="Applications"
          color="rose"
        />
        <StatTile
          icon={<PiArrowsClockwiseBold />}
          value={transfersData?.pagination.total ?? "—"}
          label="Pending Transfers"
          color="green"
        />
      </div>
    </Card>
  );
};

export default StatsWidget;
