import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FaPlus } from "react-icons/fa";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import Card from "../../../../components/ui/Card";
import PetCatalogCard from "../../../../components/ui/pets/PetCatalogCard";
import { getSpecies, getBreeds } from "../../../../logic/api/petsApi";
import {
  getMyShelterPets,
  PET_ADOPTION_STATUS_VALUES,
  type PetAdoptionStatus,
} from "../../../../logic/api/staffPetsApi";
import PetFormPanel from "./sections/pets/PetFormPanel";
import PetsFilterBar, {
  type PetsCatalogFilters,
} from "./sections/pets/PetsFilterBar";
import PaginationControls from "../../../../components/ui/dashboard/PaginationControls";

const PAGE_SIZE = 20;

type StatusFilter = PetAdoptionStatus | "all";

const STATUS_LABEL: Record<PetAdoptionStatus, string> = {
  incoming: "Incoming",
  available: "Available",
  pending: "Pending",
  adopted: "Adopted",
  fostered: "Fostered",
  transferred: "Transferred",
  deceased: "Deceased",
};

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  ...PET_ADOPTION_STATUS_VALUES.map((status) => ({
    value: status,
    label: STATUS_LABEL[status],
  })),
];

const INITIAL_CATALOG_FILTERS: PetsCatalogFilters = {
  speciesIDs: [],
  breedNames: [],
  size: [],
  minAge: "",
  maxAge: "",
};

// Pets tab — every pet at the staff member's own shelter, regardless of
// adoptionStatus (GET /staff/me/pets, not the public catalog's
// available-only GET /pets). Reuses the public catalog's PetCatalogCard for
// the grid tile (favorites hidden — staff has no favoriting concept), the
// same Species/Breed/Size/Age filter bar (minus location — one shelter, so
// nothing to filter by there), and PetFormPanel for create/edit/photos/delete.
const Pets = () => {
  const [catalogFilters, setCatalogFilters] = useState<PetsCatalogFilters>(
    INITIAL_CATALOG_FILTERS,
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingPetID, setEditingPetID] = useState<number | null>(null);

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

  const { data, isLoading, isError } = useQuery({
    queryKey: ["staff", "shelter-pets", { page, statusFilter, catalogFilters }],
    queryFn: () =>
      getMyShelterPets({
        page,
        limit: PAGE_SIZE,
        adoptionStatus: statusFilter === "all" ? undefined : statusFilter,
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
    statusFilter !== "all" ||
    catalogFilters.speciesIDs.length > 0 ||
    catalogFilters.breedNames.length > 0 ||
    catalogFilters.size.length > 0 ||
    catalogFilters.minAge !== "" ||
    catalogFilters.maxAge !== "";

  const openCreate = () => {
    setEditingPetID(null);
    setPanelOpen(true);
  };

  const openEdit = (petID: number) => {
    setEditingPetID(petID);
    setPanelOpen(true);
  };

  return (
    <div>
      <DashboardHeading
        title="Pets"
        emoji="🐾"
        message="Manage your shelter's pet profiles"
        action={{
          label: "Add Pet",
          icon: <FaPlus aria-hidden />,
          onClick: openCreate,
        }}
      />

      <PetsFilterBar
        filters={catalogFilters}
        updateFilters={updateCatalogFilters}
        speciesOptions={species}
        breedOptions={breeds}
        statusFilter={statusFilter}
        statusOptions={STATUS_OPTIONS}
        onStatusFilterChange={changeStatusFilter}
        isAgeRangeInvalid={isAgeRangeInvalid}
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
        <div className="rounded-2xl bg-white p-10 text-center shadow-md">
          <DashboardEmptyMessage>
            {hasFilters
              ? "No pets match your filters."
              : "No pets yet — add the first one to get started."}
          </DashboardEmptyMessage>
        </div>
      )}

      {pets.length > 0 && (
        <Card className="p-6">
          <div className="flex flex-wrap justify-center gap-4">
            {pets.map((pet) => (
              <div key={pet.petID} className="w-44 shrink-0">
                <PetCatalogCard
                  pet={pet}
                  openId={null}
                  onKnowMore={openEdit}
                  ctaLabel="Manage"
                  showFavorite={false}
                />
              </div>
            ))}
          </div>

          <PaginationControls page={page} totalPages={totalPages} onChange={setPage} />
        </Card>
      )}

      <PetFormPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        petID={editingPetID}
      />
    </div>
  );
};

export default Pets;
