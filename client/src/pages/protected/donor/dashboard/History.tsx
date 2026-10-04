import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PiBuildings, PiCalendarBlank, PiFunnel } from "react-icons/pi";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardWidgetHeader from "../../../../components/ui/dashboard/DashboardWidgetHeader";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import PaginationControls from "../../../../components/ui/dashboard/PaginationControls";
import { DashboardListRow } from "../../../../components/ui/dashboard/DashboardList";
import Card from "../../../../components/ui/Card";
import SelectField from "../../../../components/ui/SelectField";
import { getMyDonations } from "../../../../logic/api/donorsApi";
import { formatShortDate } from "../../../../logic/utils/datetime";
import { formatUSD } from "../../../../logic/utils/currency";
import { donationStatsQuery } from "./overview/donorQueries";

const PAGE_SIZE = 20;

type DateRange = "all" | "30d" | "thisYear" | "lastYear";

const DATE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "all", label: "All Time" },
  { value: "30d", label: "Last 30 days" },
  { value: "thisYear", label: "This year" },
  { value: "lastYear", label: "Last year" },
];

// The range as the API's dateFrom (inclusive) / dateTo (exclusive), worked
// out in the donor's own timezone. Computed in the queryFn from `dateRange`
// (which is in the key).
const rangeParams = (range: DateRange): { dateFrom?: string; dateTo?: string } => {
  const now = new Date();
  const year = now.getFullYear();
  switch (range) {
    case "30d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      from.setHours(0, 0, 0, 0);
      return { dateFrom: from.toISOString() };
    }
    case "thisYear":
      return { dateFrom: new Date(year, 0, 1).toISOString() };
    case "lastYear":
      return {
        dateFrom: new Date(year - 1, 0, 1).toISOString(),
        dateTo: new Date(year, 0, 1).toISOString(),
      };
    default:
      return {};
  }
};

// Donation History tab (/donor/history) — every donation the donor has
// made (GET /donors/me/donations, newest first), filtered by shelter and
// date range, paginated; then their totals per shelter (GET
// /donors/me/donations/stats' byShelter — the same query as the Overview
// tiles). The shelter filter offers the shelters they've given to, also
// from byShelter.
const History = () => {
  const [shelterID, setShelterID] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [page, setPage] = useState(1);

  const statsQuery = useQuery(donationStatsQuery());
  const byShelter = statsQuery.data?.byShelter ?? [];

  const historyQuery = useQuery({
    queryKey: ["donor", "donations", "history", { shelterID, dateRange, page }],
    queryFn: () =>
      getMyDonations({
        shelterID: shelterID === "all" ? undefined : Number(shelterID),
        ...rangeParams(dateRange),
        page,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });
  const donations = historyQuery.data?.data ?? [];
  const filtered = shelterID !== "all" || dateRange !== "all";

  const shelterOptions = [
    { value: "all", label: "All Shelters" },
    ...byShelter.map((s) => ({ value: String(s.shelterID), label: s.shelterName })),
  ];

  return (
    <div>
      <DashboardHeading
        title="Donation History"
        emoji="💛"
        message="Everything you've given, and where it went"
        showDate
      />

      <Card className="mb-6 p-6">
        <DashboardWidgetHeader icon="🧾" title="Your Donations" className="mb-4" />

        <div className="mb-5 rounded-2xl border border-neutral-lightgray p-4">
          <p className="mb-3 flex items-center gap-1.5 font-body text-base font-semibold text-neutral-dark">
            <PiFunnel aria-hidden /> Filters
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="Shelter"
              icon={<PiBuildings className="text-neutral-gray" />}
              value={shelterID}
              onChange={(v) => {
                setShelterID(v);
                setPage(1);
              }}
              options={shelterOptions}
            />
            <SelectField
              label="Date"
              icon={<PiCalendarBlank className="text-neutral-gray" />}
              value={dateRange}
              onChange={(v) => {
                setDateRange(v as DateRange);
                setPage(1);
              }}
              options={DATE_OPTIONS}
            />
          </div>
        </div>

        {historyQuery.isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {historyQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load your donations. Please try again.
          </p>
        )}
        {historyQuery.data && donations.length === 0 && (
          <DashboardEmptyMessage>
            {filtered
              ? "No donations match your filters."
              : "You haven't made a donation yet."}
          </DashboardEmptyMessage>
        )}

        {donations.length > 0 && (
          <ul className="flex flex-col gap-4">
            {donations.map((donation) => (
              <li key={donation.donationID}>
                <DashboardListRow
                  title={donation.shelter.shelterName}
                  lines={[
                    {
                      text: [
                        formatShortDate(new Date(donation.donationDate)),
                        donation.donationCode,
                      ]
                        .filter(Boolean)
                        .join(" · "),
                    },
                    ...(donation.donationDesc
                      ? [{ text: `“${donation.donationDesc}”` }]
                      : []),
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
        )}

        <PaginationControls
          page={page}
          totalPages={historyQuery.data?.pagination.totalPages ?? 1}
          onChange={setPage}
        />
      </Card>

      <Card className="p-6">
        <DashboardWidgetHeader icon="🏠" title="By Shelter" className="mb-4" />

        {statsQuery.isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {statsQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load your totals. Please try again.
          </p>
        )}
        {statsQuery.data && byShelter.length === 0 && (
          <DashboardEmptyMessage>
            Your totals per shelter will show here once you've donated.
          </DashboardEmptyMessage>
        )}

        {byShelter.length > 0 && (
          <ul className="flex flex-col gap-3">
            {byShelter.map((shelter) => (
              <li key={shelter.shelterID}>
                <DashboardListRow
                  className="bg-teal-light"
                  title={shelter.shelterName}
                  lines={[
                    {
                      text: `${shelter.donationCount} ${
                        shelter.donationCount === 1 ? "donation" : "donations"
                      }`,
                    },
                  ]}
                  details={
                    <p className="font-body text-base font-semibold text-neutral-dark">
                      {formatUSD(shelter.totalAmount)}
                    </p>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default History;
