import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FaPaw } from "react-icons/fa";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import ButtonElement from "../../../../components/ui/ButtonElement";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import Card from "../../../../components/ui/Card";
import SelectField from "../../../../components/ui/SelectField";
import type { BadgeTone } from "../../../../components/ui/Badge";
import {
  DashboardListRow,
  RowActionButton,
  RowMedallion,
} from "../../../../components/ui/dashboard/DashboardList";
import { getApplicationsQueue } from "../../../../logic/api/adoptionApplicationsApi";
import { getSpecies } from "../../../../logic/api/petsApi";
import { formatShortDate } from "../../../../logic/utils/datetime";
import ApplicationDetailPanel from "./sections/applications/ApplicationDetailPanel";

const PAGE_SIZE = 20;

type ApplicationStatus = "Pending" | "Accepted" | "Rejected" | "Withdrawn";

const STATUS_TONE: Record<ApplicationStatus, BadgeTone> = {
  Pending: "gold",
  Accepted: "green",
  Rejected: "red",
  Withdrawn: "gray",
};

const filterInputClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark";
const filterLabelClass =
  "mb-1.5 block font-body text-sm font-semibold text-neutral-charcoal";

const PaginationControls = ({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) =>
  totalPages > 1 ? (
    <div className="mt-6 flex items-center justify-center gap-4">
      <ButtonElement
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        size="bare"
        variant="outline"
        className="rounded-lg border border-neutral-gray px-4 py-2 text-sm font-medium text-neutral-dark hover:bg-neutral-lightgray disabled:opacity-40"
      >
        Previous
      </ButtonElement>
      <span className="font-body text-sm text-neutral-gray">
        Page {page} of {totalPages}
      </span>
      <ButtonElement
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        size="bare"
        variant="outline"
        className="rounded-lg border border-neutral-gray px-4 py-2 text-sm font-medium text-neutral-dark hover:bg-neutral-lightgray disabled:opacity-40"
      >
        Next
      </ButtonElement>
    </div>
  ) : null;

// Applications tab — Active Applications (Pending, needs a decision) and
// Past Applications (Accepted/Rejected/Withdrawn, already resolved), each
// with Species/Adopter/Pet Name filters — same Active/Past split as the
// Transfers and Appointments tabs. Entry from the Overview widget
// deep-links via ?applicationID=, read once on mount (same pattern as
// adopter dashboard's Pets.tsx ?petID=).
const Applications = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [openId, setOpenId] = useState<number | null>(() => {
    const applicationID = Number(searchParams.get("applicationID"));
    return Number.isInteger(applicationID) && applicationID > 0
      ? applicationID
      : null;
  });

  useEffect(() => {
    if (searchParams.has("applicationID")) {
      searchParams.delete("applicationID");
      setSearchParams(searchParams, { replace: true });
    }
    // Run once on mount — the initial state above already captured the value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: species = [] } = useQuery({
    queryKey: ["species"],
    queryFn: getSpecies,
  });
  const speciesOptions = [
    { value: "all", label: "All Species" },
    ...species.map((s) => ({ value: String(s.speciesID), label: s.speciesName })),
  ];

  const [activePage, setActivePage] = useState(1);
  const [activeSpecies, setActiveSpecies] = useState("all");
  const [activeAdopterName, setActiveAdopterName] = useState("");
  const [activePetName, setActivePetName] = useState("");

  const activeQuery = useQuery({
    queryKey: [
      "staff",
      "applications-queue",
      "active",
      { page: activePage, activeSpecies, activeAdopterName, activePetName },
    ],
    queryFn: () =>
      getApplicationsQueue({
        section: "active",
        species: activeSpecies === "all" ? undefined : [Number(activeSpecies)],
        adopterName: activeAdopterName || undefined,
        petName: activePetName || undefined,
        page: activePage,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const [pastPage, setPastPage] = useState(1);
  const [pastSpecies, setPastSpecies] = useState("all");
  const [pastAdopterName, setPastAdopterName] = useState("");
  const [pastPetName, setPastPetName] = useState("");

  const pastQuery = useQuery({
    queryKey: [
      "staff",
      "applications-queue",
      "past",
      { page: pastPage, pastSpecies, pastAdopterName, pastPetName },
    ],
    queryFn: () =>
      getApplicationsQueue({
        section: "past",
        species: pastSpecies === "all" ? undefined : [Number(pastSpecies)],
        adopterName: pastAdopterName || undefined,
        petName: pastPetName || undefined,
        page: pastPage,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const activeApplications = activeQuery.data?.data ?? [];
  const pastApplications = pastQuery.data?.data ?? [];

  return (
    <div>
      <DashboardHeading
        title="Applications"
        emoji="📋"
        message="Review and manage adoption applications"
      />

      <Card className="mb-6 p-6">
        <h2 className="mb-4 font-display text-xl text-neutral-dark">
          Active Applications
        </h2>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SelectField
            label="Species"
            value={activeSpecies}
            onChange={(v) => {
              setActiveSpecies(v);
              setActivePage(1);
            }}
            options={speciesOptions}
          />
          <div>
            <label className={filterLabelClass} htmlFor="active-adopter-name">
              Adopter Name
            </label>
            <input
              id="active-adopter-name"
              placeholder="Search by Adopter"
              value={activeAdopterName}
              onChange={(e) => {
                setActiveAdopterName(e.target.value);
                setActivePage(1);
              }}
              className={filterInputClass}
            />
          </div>
          <div>
            <label className={filterLabelClass} htmlFor="active-pet-name">
              Pet Name
            </label>
            <input
              id="active-pet-name"
              placeholder="Search by pet name"
              value={activePetName}
              onChange={(e) => {
                setActivePetName(e.target.value);
                setActivePage(1);
              }}
              className={filterInputClass}
            />
          </div>
        </div>

        {activeQuery.isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {activeQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load active applications. Please try again.
          </p>
        )}
        {activeQuery.data && activeApplications.length === 0 && (
          <DashboardEmptyMessage>
            No applications need your review right now.
          </DashboardEmptyMessage>
        )}

        {activeApplications.length > 0 && (
          <ul className="flex flex-col gap-4">
            {activeApplications.map((application) => (
              <li key={application.applicationID}>
                <DashboardListRow
                  leading={
                    <RowMedallion
                      src={application.pet.petPhoto}
                      alt={`${application.pet.petName} photo`}
                      fallback={<FaPaw className="h-6 w-6 text-rose-dark" aria-hidden />}
                    />
                  }
                  title={`${application.pet.petName} - ${application.pet.speciesName}`}
                  lines={[
                    { text: `Submitted by: ${application.adopter.adopterName}` },
                    {
                      text: `Submitted on: ${formatShortDate(new Date(application.createdAt))}`,
                      strong: true,
                    },
                  ]}
                  actions={
                    <RowActionButton onClick={() => setOpenId(application.applicationID)}>
                      View Details
                    </RowActionButton>
                  }
                />
              </li>
            ))}
          </ul>
        )}

        <PaginationControls
          page={activePage}
          totalPages={activeQuery.data?.pagination.totalPages ?? 1}
          onChange={setActivePage}
        />
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 font-display text-xl text-neutral-dark">
          Past Applications
        </h2>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SelectField
            label="Species"
            value={pastSpecies}
            onChange={(v) => {
              setPastSpecies(v);
              setPastPage(1);
            }}
            options={speciesOptions}
          />
          <div>
            <label className={filterLabelClass} htmlFor="past-adopter-name">
              Adopter Name
            </label>
            <input
              id="past-adopter-name"
              placeholder="Search by Adopter"
              value={pastAdopterName}
              onChange={(e) => {
                setPastAdopterName(e.target.value);
                setPastPage(1);
              }}
              className={filterInputClass}
            />
          </div>
          <div>
            <label className={filterLabelClass} htmlFor="past-pet-name">
              Pet Name
            </label>
            <input
              id="past-pet-name"
              placeholder="Search by pet name"
              value={pastPetName}
              onChange={(e) => {
                setPastPetName(e.target.value);
                setPastPage(1);
              }}
              className={filterInputClass}
            />
          </div>
        </div>

        {pastQuery.isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {pastQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load past applications. Please try again.
          </p>
        )}
        {pastQuery.data && pastApplications.length === 0 && (
          <DashboardEmptyMessage>
            No past applications match your filters.
          </DashboardEmptyMessage>
        )}

        {pastApplications.length > 0 && (
          <ul className="flex flex-col gap-4">
            {pastApplications.map((application) => (
              <li key={application.applicationID}>
                <DashboardListRow
                  className="bg-neutral-lightgray"
                  leading={
                    <RowMedallion
                      src={application.pet.petPhoto}
                      alt={`${application.pet.petName} photo`}
                      fallback={<FaPaw className="h-6 w-6 text-rose-dark" aria-hidden />}
                    />
                  }
                  title={`${application.pet.petName} - ${application.pet.speciesName}`}
                  lines={[
                    { text: `Submitted by: ${application.adopter.adopterName}` },
                    {
                      text: `Submitted on: ${formatShortDate(new Date(application.createdAt))}`,
                      strong: true,
                    },
                  ]}
                  badge={{
                    label: application.applicationStatus,
                    tone: STATUS_TONE[application.applicationStatus],
                  }}
                  actions={
                    <RowActionButton onClick={() => setOpenId(application.applicationID)}>
                      View Details
                    </RowActionButton>
                  }
                />
              </li>
            ))}
          </ul>
        )}

        <PaginationControls
          page={pastPage}
          totalPages={pastQuery.data?.pagination.totalPages ?? 1}
          onChange={setPastPage}
        />
      </Card>

      <ApplicationDetailPanel
        applicationID={openId}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
};

export default Applications;
