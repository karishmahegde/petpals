// RecentDonationsWidget.tsx
// "Recent Donations" on the donor Overview — the donor's latest donations
// (GET /donors/me/donations, newest first). "View All" goes to the Donation
// History tab.
import { useQuery } from "@tanstack/react-query";
import { OverviewWidgetCard } from "../../../../../components/ui/dashboard/DashboardWidgetHeader";
import { DashboardListRow } from "../../../../../components/ui/dashboard/DashboardList";
import { formatShortDate } from "../../../../../logic/utils/datetime";
import { formatUSD } from "../../../../../logic/utils/currency";
import { recentDonationsQuery } from "./donorQueries";

const RecentDonationsWidget = () => {
  const { data, isLoading } = useQuery(recentDonationsQuery);
  const donations = data?.data ?? [];

  return (
    <OverviewWidgetCard
      icon="💛"
      title="Recent Donations"
      action={{ label: "View All", to: "/donor/history" }}
      className="min-h-[320px]"
      isLoading={isLoading}
      isEmpty={donations.length === 0}
      emptyMessage="No donations yet — your first one will show here"
    >
      <ul className="flex flex-col gap-4">
        {donations.map((donation) => (
          <li key={donation.donationID}>
            <DashboardListRow
              title={donation.shelter.shelterName}
              lines={[
                { text: formatShortDate(new Date(donation.donationDate)) },
                ...(donation.donationDesc ? [{ text: `“${donation.donationDesc}”` }] : []),
              ]}
              details={
                <p className="font-body text-base font-semibold text-neutral-dark">
                  {formatUSD(donation.donationAmt)}
                </p>
              }
            />
          </li>
        ))}
      </ul>
    </OverviewWidgetCard>
  );
};

export default RecentDonationsWidget;
