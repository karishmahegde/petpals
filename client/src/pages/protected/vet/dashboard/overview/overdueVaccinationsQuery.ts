// overdueVaccinationsQuery.ts
// GET /vets/me/vaccinations/overdue, shared by the Overview's Overdue
// Vaccinations tile (StatsWidget) and widget, so both read one request.
import { getMyOverdueVaccinations } from "../../../../../logic/api/vetsApi";

export const overdueVaccinationsQuery = {
  queryKey: ["vet", "vaccinations", "overdue"],
  queryFn: getMyOverdueVaccinations,
};
