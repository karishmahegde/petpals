// EventFilterBar.tsx
// Filters card for the public Events page — same collapsible "Filters" card,
// Shelter CheckboxDropdown and field styling as the /adopt catalog's
// PetFilterBar, including a removable Pill per selected shelter. Stateless:
// Events.tsx owns the filter values.
import { useState } from "react";
import { FaChevronDown } from "react-icons/fa";
import { BiFilterAlt } from "react-icons/bi";
import { FiHome, FiSearch } from "react-icons/fi";
import type { Shelter } from "../../../logic/api/petsApi";
import Card from "../../../components/ui/Card";
import ButtonElement from "../../../components/ui/ButtonElement";
import {
  CheckboxDropdown,
  Pill,
} from "../../../components/ui/pets/FilterControls";

interface EventFilterBarProps {
  shelterOptions: Shelter[];
  selectedShelterIDs: number[];
  onSelectedShelterIDsChange: (ids: number[]) => void;
  eventName: string;
  onEventNameChange: (name: string) => void;
}

const EventFilterBar = ({
  shelterOptions,
  selectedShelterIDs,
  onSelectedShelterIDsChange,
  eventName,
  onEventNameChange,
}: EventFilterBarProps) => {
  const [isOpen, setIsOpen] = useState(true);

  const toggleShelter = (shelterID: number) =>
    onSelectedShelterIDsChange(
      selectedShelterIDs.includes(shelterID)
        ? selectedShelterIDs.filter((id) => id !== shelterID)
        : [...selectedShelterIDs, shelterID],
    );

  return (
    <Card className="mb-8 p-6">
      <ButtonElement
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        size="bare"
        variant="outline"
        className="flex w-full items-center justify-between"
      >
        <span className="flex items-center gap-2">
          <BiFilterAlt className="text-neutral-charcoal" />
          <h2 className="text-lg font-bold text-neutral-dark">Filters</h2>
        </span>
        <FaChevronDown
          className={`text-neutral-gray transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </ButtonElement>

      <div className={isOpen ? "" : "hidden"}>
        <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <CheckboxDropdown
            icon={<FiHome className="text-neutral-gray" />}
            label="Shelter"
            placeholder="All Shelters"
            options={shelterOptions.map((s) => ({
              value: s.shelterID,
              label: s.shelterName,
            }))}
            selectedValues={selectedShelterIDs}
            onToggle={(value) => toggleShelter(value as number)}
          />

          <div>
            <label
              htmlFor="event-name-search"
              className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-neutral-charcoal"
            >
              <FiSearch className="text-neutral-gray" />
              Event Name
            </label>
            <input
              id="event-name-search"
              placeholder="Search by event name"
              value={eventName}
              onChange={(e) => onEventNameChange(e.target.value)}
              className="w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 text-sm text-neutral-charcoal placeholder:italic placeholder:text-neutral-gray focus:outline-none focus:ring-1 focus:ring-teal-dark"
            />
          </div>
        </div>

        {selectedShelterIDs.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedShelterIDs.map((id) => (
              <Pill
                key={`shelter-${id}`}
                label={
                  shelterOptions.find((s) => s.shelterID === id)?.shelterName ??
                  String(id)
                }
                variant="shelter"
                onRemove={() => toggleShelter(id)}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};

export default EventFilterBar;
