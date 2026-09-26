import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FaPlus } from "react-icons/fa";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import PetFormPanel from "./sections/pets/PetFormPanel";
import PetsSection from "./sections/pets/PetsSection";

// Pets tab — two PetsSections over GET /staff/me/pets (not the public
// catalog's available-only GET /pets): Incoming Pets (adoptionStatus
// "incoming" — new arrivals not yet in the public catalog, newest first)
// above All Pets (every pet at the shelter, incoming included). Both reuse
// the public catalog's PetCatalogCard and the same Species/Breed/Size/Age
// filter bar; "Manage" opens PetFormPanel for view/edit/photos/delete,
// where staff move an incoming pet on to Available (or any other status).
// Entry from the Overview's New Arrivers widget deep-links via ?petID=,
// read once on mount (same pattern as Applications' ?applicationID=).
const Pets = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [panelOpen, setPanelOpen] = useState(() =>
    isValidPetID(searchParams.get("petID")),
  );
  const [editingPetID, setEditingPetID] = useState<number | null>(() => {
    const petID = searchParams.get("petID");
    return isValidPetID(petID) ? Number(petID) : null;
  });

  useEffect(() => {
    if (searchParams.has("petID")) {
      searchParams.delete("petID");
      setSearchParams(searchParams, { replace: true });
    }
    // Run once on mount — the initial state above already captured the value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      <PetsSection
        icon="🐶"
        title="Incoming Pets"
        fixedStatus="incoming"
        emptyMessage="No incoming pets right now."
        onManage={openEdit}
        className="mb-6"
      />

      <PetsSection
        icon="🐾"
        title="All Pets"
        emptyMessage="No pets yet — add the first one to get started."
        onManage={openEdit}
      />

      <PetFormPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        petID={editingPetID}
      />
    </div>
  );
};

function isValidPetID(value: string | null): boolean {
  const petID = Number(value);
  return value !== null && Number.isInteger(petID) && petID > 0;
}

export default Pets;
