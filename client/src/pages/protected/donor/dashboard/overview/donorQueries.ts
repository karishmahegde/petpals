// donorQueries.ts
// The donor dashboard's queries. Keys sit under ["donor", "donations"], so
// the confirmation page can refresh every one of them (stats, recent,
// history) with a single prefix invalidation once a new donation lands.
import { getMyDonationStats, getMyDonations } from "../../../../../logic/api/donorsApi";

// Local start of this calendar year, as ISO — "this year" follows the
// donor's own timezone. In the key, so a new year refetches.
const startOfYearISO = () => new Date(new Date().getFullYear(), 0, 1).toISOString();

export const donationStatsQuery = () => {
  const yearStart = startOfYearISO();
  return {
    queryKey: ["donor", "donations", "stats", { yearStart }],
    queryFn: () => getMyDonationStats(yearStart),
  };
};

const RECENT_LIMIT = 3;
export const recentDonationsQuery = {
  queryKey: ["donor", "donations", "recent", { limit: RECENT_LIMIT }],
  queryFn: () => getMyDonations({ limit: RECENT_LIMIT }),
};
