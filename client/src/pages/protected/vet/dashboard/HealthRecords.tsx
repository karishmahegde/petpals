// HealthRecords.tsx
// Vet Health Records tab — pets at the vet's shelter (GET /vets/me/pets),
// searchable by name and filtered with the same Species/Breed/Size/Age/
// Status bar as the Staff Pets tab (shared PetsFilterBar). Each row opens
// the pet's universal health passport.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FaPaw, FaSearch } from "react-icons/fa";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardWidgetHeader from "../../../../components/ui/dashboard/DashboardWidgetHeader";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import PaginationControls from "../../../../components/ui/dashboard/PaginationControls";
import Card from "../../../../components/ui/Card";
import {
  DashboardListRow,
  RowActionButton,
  RowMedallion,
} from "../../../../components/ui/dashboard/DashboardList";
import { getBreeds, getSpecies } from "../../../../logic/api/petsApi";
import {
  PET_ADOPTION_STATUS_VALUES,
  type PetAdoptionStatus,
} from "../../../../logic/api/staffPetsApi";
import { getMyVetPets } from "../../../../logic/api/vetsApi";
import { PET_STATUS_META } from "../../../../logic/staff/petStatus";
import PetsFilterBar, {
  type PetsCatalogFilters,
} from "../../shared/PetsFilterBar";

const PAGE_SIZE = 20;

type StatusFilter = PetAdoptionStatus | "all";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  ...PET_ADOPTION_STATUS_VALUES.map((status) => ({
    value: status,
    label: PET_STATUS_META[status].label,
  })),
];

const INITIAL_CATALOG_FILTERS: PetsCatalogFilters = {
  speciesIDs: [],
  breedNames: [],
  size: [],
  minAge: "",
  maxAge: "",
};

const HealthRecords = () => {
  const navigate = useNavigate();
  const [petName, setPetName] = useState("");
  const [catalogFilters, setCatalogFilters] = useState<PetsCatalogFilters>(
    INITIAL_CATALOG_FILTERS,
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const updateCatalogFilters = (partial: Partial<PetsCatalogFilters>) => {
    setCatalogFilters((prev) => ({ ...prev, ...partial }));
    setPage(1);
  };

  const changeStatusFilter = (value: StatusFilter) => {
    setStatusFilter(value);
    setPage(1);
  };

  const { data: species = [] } = useQuery({
    queryKey: ["species"],
    queryFn: getSpecies,
  });

  const { data: breeds = [] } = useQuery({
    queryKey: ["breeds", catalogFilters.speciesIDs],
    queryFn: () => getBreeds(catalogFilters.speciesIDs),
    enabled: catalogFilters.speciesIDs.length > 0,
  });

  const isAgeRangeInvalid =
    catalogFilters.minAge !== "" &&
    catalogFilters.maxAge !== "" &&
    Number(catalogFilters.minAge) > Number(catalogFilters.maxAge);

  const trimmedName = petName.trim();

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "vet",
      "shelter-pets",
      { page, statusFilter, catalogFilters, petName: trimmedName },
    ],
    queryFn: () =>
      getMyVetPets({
        page,
        limit: PAGE_SIZE,
        adoptionStatus: statusFilter === "all" ? undefined : statusFilter,
        petName: trimmedName || undefined,
        species:
          catalogFilters.speciesIDs.length > 0
            ? catalogFilters.speciesIDs
            : undefined,
        breed:
          catalogFilters.breedNames.length > 0
            ? catalogFilters.breedNames
            : undefined,
        size: catalogFilters.size.length > 0 ? catalogFilters.size : undefined,
        minAge: catalogFilters.minAge || undefined,
        maxAge: catalogFilters.maxAge || undefined,
      }),
    placeholderData: keepPreviousData,
    enabled: !isAgeRangeInvalid,
  });

  const pets = data?.data ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;
  const hasFilters =
    trimmedName !== "" ||
    statusFilter !== "all" ||
    catalogFilters.speciesIDs.length > 0 ||
    catalogFilters.breedNames.length > 0 ||
    catalogFilters.size.length > 0 ||
    catalogFilters.minAge !== "" ||
    catalogFilters.maxAge !== "";

  return (
    <div>
      <DashboardHeading
        title="Health Records"
        emoji="📋"
        message="Access and manage patient health records"
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
            placeholder="Search by pet name"
            aria-label="Search by pet name"
            value={petName}
            onChange={(e) => {
              setPetName(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-full border border-neutral-lightgray bg-white py-2.5 pl-4 pr-10 font-body text-sm text-neutral-charcoal placeholder:italic placeholder:text-neutral-gray focus:outline-none focus:ring-1 focus:ring-teal-dark"
          />
          <FaSearch
            aria-hidden
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-neutral-gray"
          />
        </div>

        <PetsFilterBar
          filters={catalogFilters}
          updateFilters={updateCatalogFilters}
          speciesOptions={species}
          breedOptions={breeds}
          isAgeRangeInvalid={isAgeRangeInvalid}
          statusFilter={statusFilter}
          statusOptions={STATUS_OPTIONS}
          onStatusFilterChange={changeStatusFilter}
        />

        {isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading pets…</p>
        )}

        {isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load pets. Please try again.
          </p>
        )}

        {data && pets.length === 0 && (
          <DashboardEmptyMessage>
            {hasFilters
              ? "No pets match your search."
              : "No pets at your shelter yet."}
          </DashboardEmptyMessage>
        )}

        {pets.length > 0 && (
          <>
            <ul className="flex flex-col gap-4">
              {pets.map((pet) => (
                <li key={pet.petID}>
                  <DashboardListRow
                    leading={
                      <RowMedallion
                        src={pet.petPhoto}
                        alt={pet.petName}
                        fallback={<FaPaw className="text-rose-dark" />}
                      />
                    }
                    title={`${pet.petName} - ${pet.breed.breedName} | ${pet.breed.speciesName}`}
                    lines={[{ text: `${pet.petAge} · ${pet.petSex}` }]}
                    badge={{
                      label: PET_STATUS_META[pet.adoptionStatus].label,
                      tone: PET_STATUS_META[pet.adoptionStatus].tone,
                    }}
                    actions={
                      <RowActionButton
                        onClick={() =>
                          navigate(
                            `/vet/health-records/${pet.petID}/health-passport`,
                          )
                        }
                      >
                        View Health Passport
                      </RowActionButton>
                    }
                  />
                </li>
              ))}
            </ul>

            <PaginationControls
              page={page}
              totalPages={totalPages}
              onChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
};

export default HealthRecords;
