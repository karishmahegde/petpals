import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FaPlus, FaSearch } from "react-icons/fa";
import { BiFilterAlt } from "react-icons/bi";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import Card from "../../../../components/ui/Card";
import SelectField from "../../../../components/ui/SelectField";
import {
  getShelterAnalytics,
  type ShelterAnalyticsItem,
} from "../../../../logic/api/analyticsApi";
import type { ShelterStatus } from "../../../../logic/api/sheltersApi";
import ShelterRow from "./sections/shelters/ShelterRow";
import ShelterFormPanel from "./sections/shelters/ShelterFormPanel";

type StatusFilter = ShelterStatus | "All";
const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "All", label: "All Statuses" },
  { value: "Open", label: "Open" },
  { value: "Full", label: "Full" },
  { value: "Closed", label: "Closed" },
];

// No SelectField equivalent for free text — styled to match its trigger
// button (py-2.5, same border/text tokens) for visual consistency.
const searchFieldClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark";

// Shelters tab — every shelter in the network, filterable by status/name,
// with create/edit. Read side is GET /analytics/shelters (list + status +
// capacity); writes are the Admin shelter-management endpoints, all fired
// from ShelterFormPanel.
const Shelters = () => {
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingShelter, setEditingShelter] =
    useState<ShelterAnalyticsItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [search, setSearch] = useState("");

  const { data: shelters, isLoading } = useQuery({
    queryKey: ["admin", "shelters-analytics"],
    queryFn: () => getShelterAnalytics(),
  });

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (shelters ?? []).filter(
      (shelter) =>
        (statusFilter === "All" || shelter.shelterStatus === statusFilter) &&
        shelter.shelterName.toLowerCase().includes(query),
    );
  }, [shelters, statusFilter, search]);

  return (
    <div>
      <DashboardHeading
        title="Shelters"
        emoji="🏢"
        message="Manage your shelter network"
        action={{
          label: "Add Shelter",
          icon: <FaPlus aria-hidden />,
          onClick: () => {
            setEditingShelter(null);
            setPanelOpen(true);
          },
        }}
      />

      {/* Filters */}
      <Card className="mb-6 p-5">
        <div className="mb-3 flex items-center gap-2 font-body text-sm font-semibold text-neutral-charcoal">
          <BiFilterAlt />
          Filters
        </div>
        <div className="flex flex-col gap-4 sm:flex-row">
          <SelectField
            label="Status"
            className="flex-1"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
            options={STATUS_FILTER_OPTIONS}
          />

          <div className="flex-1">
            <label
              className="mb-1.5 flex items-center gap-2 font-body text-sm font-semibold text-neutral-charcoal"
              htmlFor="shelter-name-search"
            >
              Search by shelter name
            </label>
            <div className="relative">
              <input
                id="shelter-name-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Shelter Name"
                className={`${searchFieldClass} pr-9`}
              />
              <FaSearch
                aria-hidden
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-gray"
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        {isLoading ? (
          <p className="py-8 text-center font-body text-sm text-neutral-gray">
            Loading shelters…
          </p>
        ) : filtered.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {filtered.map((shelter) => (
              <li key={shelter.shelterID}>
                <ShelterRow
                  shelter={shelter}
                  onEdit={(s) => {
                    setEditingShelter(s);
                    setPanelOpen(true);
                  }}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center font-body text-sm text-neutral-gray">
            {shelters && shelters.length > 0
              ? "No shelters match your filters."
              : "No shelters yet — add the first one to get started."}
          </p>
        )}
      </Card>

      <ShelterFormPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        shelter={editingShelter}
      />
    </div>
  );
};

export default Shelters;
