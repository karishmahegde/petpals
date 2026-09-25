import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PiCalendarCheckBold, PiHandHeartBold, PiPiggyBankBold } from "react-icons/pi";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardWidgetHeader from "../../../../components/ui/dashboard/DashboardWidgetHeader";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import StatTile from "../../../../components/ui/dashboard/StatTile";
import PaginationControls from "../../../../components/ui/dashboard/PaginationControls";
import Card from "../../../../components/ui/Card";
import SelectField from "../../../../components/ui/SelectField";
import {
  DashboardListRow,
  RowActionButton,
} from "../../../../components/ui/dashboard/DashboardList";
import { getDonationStats, getDonations } from "../../../../logic/api/donationsApi";
import { formatShortDate } from "../../../../logic/utils/datetime";
import { formatUSD } from "../../../../logic/utils/currency";
import DonationDetailPanel from "./sections/donations/DonationDetailPanel";

const PAGE_SIZE = 20;

type DateFilter = "all" | "month" | "3months" | "year";

const DATE_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "month", label: "This month" },
  { value: "3months", label: "Last 3 months" },
  { value: "year", label: "This year" },
];

// Matches SelectField's own label + trigger sizing, same as Transfers.tsx.
const filterInputClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark";
const filterLabelClass =
  "mb-1.5 block font-body text-sm font-semibold text-neutral-charcoal";

// Local midnight on the 1st of this month — the "This Month" tile and filter.
const startOfMonth = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(1);
  return date;
};

// Lower bound for each date option, in the viewer's own timezone.
const dateFromFor = (filter: DateFilter): string | undefined => {
  if (filter === "all") return undefined;
  if (filter === "month") return startOfMonth().toISOString();
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  if (filter === "3months") date.setMonth(date.getMonth() - 3);
  else date.setMonth(0, 1); // year → Jan 1
  return date.toISOString();
};

// Donations tab — three stat tiles (total received, distinct donors, this
// month) over all of the shelter's donations, then All Donations (newest
// first) with a date filter and donor-name search. Rows open
// DonationDetailPanel. Everything is GET /donations*, scoped server-side to
// the caller's shelter. Read-only: donations come from donors.
const Donations = () => {
  const [openId, setOpenId] = useState<number | null>(null);

  const monthStart = startOfMonth().toISOString();
  const { data: stats } = useQuery({
    queryKey: ["staff", "donations", "stats", { monthStart }],
    queryFn: () => getDonationStats(monthStart),
  });

  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [donorName, setDonorName] = useState("");

  const listQuery = useQuery({
    queryKey: ["staff", "donations", "list", { page, dateFilter, donorName }],
    queryFn: () =>
      getDonations({
        dateFrom: dateFromFor(dateFilter),
        donorName: donorName.trim() || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });
  const donations = listQuery.data?.data ?? [];
  const hasFilters = dateFilter !== "all" || donorName.trim() !== "";

  return (
    <div>
      <DashboardHeading
        title="Donations"
        emoji="💰"
        message="Track donations received at your shelter"
      />

      <Card className="mb-6 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:gap-5">
          <StatTile
            icon={<PiPiggyBankBold />}
            value={stats ? formatUSD(stats.totalAmount) : "—"}
            label="Total Donations"
            color="gold"
          />
          <StatTile
            icon={<PiHandHeartBold />}
            value={stats?.totalDonors ?? "—"}
            label="Total Donors"
            color="teal"
          />
          <StatTile
            icon={<PiCalendarCheckBold />}
            value={stats ? formatUSD(stats.thisMonthAmount) : "—"}
            label="This Month"
            color="rose"
          />
        </div>
      </Card>

      <Card className="p-6">
        <DashboardWidgetHeader icon="💛" title="All Donations" className="mb-4" />

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Date"
            value={dateFilter}
            onChange={(v) => {
              setDateFilter(v as DateFilter);
              setPage(1);
            }}
            options={DATE_OPTIONS}
          />
          <div>
            <label className={filterLabelClass} htmlFor="donor-name">
              Donor Name
            </label>
            <input
              id="donor-name"
              placeholder="Search by donor name"
              value={donorName}
              onChange={(e) => {
                setDonorName(e.target.value);
                setPage(1);
              }}
              className={filterInputClass}
            />
          </div>
        </div>

        {listQuery.isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {listQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load donations. Please try again.
          </p>
        )}
        {listQuery.data && donations.length === 0 && (
          <DashboardEmptyMessage>
            {hasFilters ? "No donations match your filters." : "No donations yet."}
          </DashboardEmptyMessage>
        )}

        {donations.length > 0 && (
          <ul className="flex flex-col gap-4">
            {donations.map((donation) => (
              <li key={donation.donationID}>
                <DashboardListRow
                  title={donation.donorName}
                  lines={[
                    { text: formatShortDate(new Date(donation.donationDate)) },
                    { text: formatUSD(donation.donationAmt), strong: true },
                  ]}
                  actions={
                    <RowActionButton onClick={() => setOpenId(donation.donationID)}>
                      View Details
                    </RowActionButton>
                  }
                />
              </li>
            ))}
          </ul>
        )}

        <PaginationControls
          page={page}
          totalPages={listQuery.data?.pagination.totalPages ?? 1}
          onChange={setPage}
        />
      </Card>

      <DonationDetailPanel donationID={openId} onClose={() => setOpenId(null)} />
    </div>
  );
};

export default Donations;
