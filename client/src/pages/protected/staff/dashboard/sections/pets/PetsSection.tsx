// PetsSection.tsx
// One titled section of the staff Pets tab — its own Species/Breed/Size/Age
// filters, paginated GET /staff/me/pets query, and PetCatalogCard grid.
// Rendered twice by Pets.tsx: Incoming Pets (fixedStatus "incoming", newest
// intake first, no Status dropdown since the status is the section) and
// All Pets (every pet at the shelter, with the Status dropdown and a
// status Badge on each card's top-right corner). Each
// section's filters/page are independent, so they live here rather than in
// the page; the page only owns which pet's panel is open (onManage).
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import DashboardEmptyMessage from "../../../../../../components/ui/dashboard/DashboardEmptyMessage";
import DashboardWidgetHeader from "../../../../../../components/ui/dashboard/DashboardWidgetHeader";
import PaginationControls from "../../../../../../components/ui/dashboard/PaginationControls";
import Badge from "../../../../../../components/ui/Badge";
import Card from "../../../../../../components/ui/Card";
import PetCatalogCard from "../../../../../../components/ui/pets/PetCatalogCard";
import { getBreeds, getSpecies } from "../../../../../../logic/api/petsApi";
import {
  getMyShelterPets,
  PET_ADOPTION_STATUS_VALUES,
  type PetAdoptionStatus,
} from "../../../../../../logic/api/staffPetsApi";
import { PET_STATUS_META } from "../../../../../../logic/staff/petStatus";
import PetsFilterBar, { type PetsCatalogFilters } from "./PetsFilterBar";

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

interface PetsSectionProps {
  icon: string;
  title: string;
  /** Locks the section to one status (no Status dropdown, newest first). */
  fixedStatus?: PetAdoptionStatus;
  /** Shown when the section is empty with no filters applied. */
  emptyMessage: string;
  onManage: (petID: number) => void;
  className?: string;
}

const PetsSection = ({
  icon,
  title,
  fixedStatus,
  emptyMessage,
  onManage,
  className = "",
}: PetsSectionProps) => {
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

  const adoptionStatus =
    fixedStatus ?? (statusFilter === "all" ? undefined : statusFilter);

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "staff",
      "shelter-pets",
      { page, adoptionStatus, fixedStatus, catalogFilters },
    ],
    queryFn: () =>
      getMyShelterPets({
        page,
        limit: PAGE_SIZE,
        adoptionStatus,
        sort: fixedStatus ? "newest" : undefined,
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
    (!fixedStatus && statusFilter !== "all") ||
    catalogFilters.speciesIDs.length > 0 ||
    catalogFilters.breedNames.length > 0 ||
    catalogFilters.size.length > 0 ||
    catalogFilters.minAge !== "" ||
    catalogFilters.maxAge !== "";

  return (
    <Card className={`p-6 ${className}`}>
      <DashboardWidgetHeader icon={icon} title={title} className="mb-4" />

      <PetsFilterBar
        filters={catalogFilters}
        updateFilters={updateCatalogFilters}
        speciesOptions={species}
        breedOptions={breeds}
        isAgeRangeInvalid={isAgeRangeInvalid}
        {...(fixedStatus
          ? {}
          : {
              statusFilter,
              statusOptions: STATUS_OPTIONS,
              onStatusFilterChange: changeStatusFilter,
            })}
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
          {hasFilters ? "No pets match your filters." : emptyMessage}
        </DashboardEmptyMessage>
      )}

      {pets.length > 0 && (
        <>
          <div className="flex flex-wrap justify-center gap-4">
            {pets.map((pet) => (
              <div key={pet.petID} className="w-44 shrink-0">
                <PetCatalogCard
                  pet={pet}
                  openId={null}
                  onKnowMore={onManage}
                  ctaLabel="Manage"
                  showFavorite={false}
                  cornerBadge={
                    fixedStatus ? undefined : (
                      <Badge tone={PET_STATUS_META[pet.adoptionStatus].tone}>
                        {PET_STATUS_META[pet.adoptionStatus].label}
                      </Badge>
                    )
                  }
                />
              </div>
            ))}
          </div>

          <PaginationControls
            page={page}
            totalPages={totalPages}
            onChange={setPage}
          />
        </>
      )}
    </Card>
  );
};

export default PetsSection;
