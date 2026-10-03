// Vaccinations.tsx
// Vet Vaccinations tab — the network-wide vaccine catalog (GET /vaccines),
// searchable by name. "Add Vaccine" and each row's "Edit" open
// VaccineFormPanel; the page owns which vaccine (if any) is open. Doses
// themselves are recorded from an appointment, not here.
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FaPlus, FaSearch } from "react-icons/fa";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardWidgetHeader from "../../../../components/ui/dashboard/DashboardWidgetHeader";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import Card from "../../../../components/ui/Card";
import {
  DashboardListRow,
  RowActionButton,
} from "../../../../components/ui/dashboard/DashboardList";
import { getVaccines, type Vaccine } from "../../../../logic/api/vaccinationsApi";
import VaccineFormPanel from "./sections/vaccinations/VaccineFormPanel";

const Vaccinations = () => {
  const [name, setName] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Vaccine | null>(null);

  const trimmedName = name.trim();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["vaccines", { name: trimmedName }],
    queryFn: () => getVaccines(trimmedName || undefined),
    placeholderData: keepPreviousData,
  });
  const vaccines = data ?? [];

  const openAdd = () => {
    setEditing(null);
    setPanelOpen(true);
  };

  const openEdit = (vaccine: Vaccine) => {
    setEditing(vaccine);
    setPanelOpen(true);
  };

  return (
    <div>
      <DashboardHeading
        title="Vaccinations"
        emoji="💉"
        message="Vaccine catalogue for the network"
        showDate
        action={{
          label: "Add Vaccine",
          icon: <FaPlus aria-hidden />,
          onClick: openAdd,
        }}
      />

      <Card className="p-6">
        <DashboardWidgetHeader
          icon="🔎"
          title="Search Records"
          className="mb-4"
        />

        <div className="relative mb-4">
          <input
            type="search"
            placeholder="Search by name"
            aria-label="Search vaccines by name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-full border border-neutral-lightgray bg-white py-2.5 pl-4 pr-10 font-body text-sm text-neutral-charcoal placeholder:italic placeholder:text-neutral-gray focus:outline-none focus:ring-1 focus:ring-teal-dark"
          />
          <FaSearch
            aria-hidden
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-neutral-gray"
          />
        </div>

        {isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading vaccines…</p>
        )}

        {isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load vaccines. Please try again.
          </p>
        )}

        {data && vaccines.length === 0 && (
          <DashboardEmptyMessage>
            {trimmedName
              ? "No vaccines match your search."
              : "No vaccines yet — add the first one to get started."}
          </DashboardEmptyMessage>
        )}

        {vaccines.length > 0 && (
          <ul className="flex flex-col gap-4">
            {vaccines.map((vaccine) => (
              <li key={vaccine.vaccineID}>
                <DashboardListRow
                  title={
                    vaccine.manufacturer
                      ? `${vaccine.vaccineName} · ${vaccine.manufacturer}`
                      : vaccine.vaccineName
                  }
                  lines={
                    vaccine.vaccineDesc ? [{ text: vaccine.vaccineDesc }] : []
                  }
                  actions={
                    <RowActionButton onClick={() => openEdit(vaccine)}>
                      Edit
                    </RowActionButton>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <VaccineFormPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        vaccine={editing}
      />
    </div>
  );
};

export default Vaccinations;
