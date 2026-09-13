// ScheduleVisitPanel.tsx
// Form to schedule a shelter visit or pet meet-and-greet — opened from the
// Visits page's header "+ Schedule Visit" button (DashboardHeading's action),
// or pre-filled and auto-opened via ?petID= when arriving from a pet detail
// page. SlideOver owns the chrome; this component owns the form state and the
// POST /visits mutation.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import SlideOver from "../../../../../components/ui/SlideOver";
import { getShelters, getPets, getPetById } from "../../../../../logic/api/petsApi";
import { createVisit } from "../../../../../logic/api/visitsApi";

interface ScheduleVisitPanelProps {
  open: boolean;
  onClose: () => void;
  /** Pre-selects this pet (and its shelter) — set when arriving via ?petID=. */
  initialPetID?: number | null;
}

const labelClass = "mb-1.5 block font-body text-sm font-semibold text-neutral-charcoal";
const fieldClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark disabled:bg-neutral-offwhite disabled:text-neutral-gray";
const REMARKS_MAX = 300;

// "Now", ceil'd to the next 15-minute mark, formatted for
// <input type="datetime-local"> — used as `min` so the picker itself blocks
// past dates/times. (The server independently re-validates visitTime is in
// the future at submit time, so this is UX guidance, not the source of truth.)
const FIFTEEN_MIN_MS = 15 * 60 * 1000;
const minDateTimeLocal = () => {
  const d = new Date(Math.ceil(Date.now() / FIFTEEN_MIN_MS) * FIFTEEN_MIN_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const ScheduleVisitPanel = ({
  open,
  onClose,
  initialPetID,
}: ScheduleVisitPanelProps) => {
  const queryClient = useQueryClient();

  const [shelterID, setShelterID] = useState<number | "">("");
  const [petID, setPetID] = useState<number | "">("");
  const [visitTime, setVisitTime] = useState("");
  const [remarks, setRemarks] = useState("");

  const { data: shelters } = useQuery({
    queryKey: ["shelters"],
    queryFn: getShelters,
    enabled: open,
  });

  // Deep-linked pet — also tells us which shelter to preselect.
  const { data: initialPet } = useQuery({
    queryKey: ["pet", initialPetID],
    queryFn: () => getPetById(initialPetID!),
    enabled: open && initialPetID != null,
  });

  const { data: shelterPetsPage } = useQuery({
    queryKey: ["pets", "by-shelter", shelterID],
    queryFn: () => getPets({ shelterID: [shelterID as number] }, 1, 100),
    enabled: open && shelterID !== "",
  });
  const shelterPets = shelterPetsPage?.data ?? [];

  // Reset to a blank form each time the panel opens without a pet deep-link;
  // apply the deep-link's shelter + pet once it's fetched.
  useEffect(() => {
    if (!open) return;
    if (initialPetID == null) {
      setShelterID("");
      setPetID("");
      setVisitTime("");
      setRemarks("");
    }
  }, [open, initialPetID]);

  useEffect(() => {
    if (initialPet) {
      setShelterID(initialPet.shelter.shelterID);
      setPetID(initialPet.petID);
    }
  }, [initialPet]);

  const mutation = useMutation({
    mutationFn: () =>
      createVisit({
        shelterID: shelterID as number,
        petID: petID === "" ? null : petID,
        visitTime: new Date(visitTime).toISOString(),
        remarks: remarks.trim() ? remarks.trim() : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adopter", "visits"] });
      toast.success("Visit scheduled!");
      onClose();
    },
    onError: () =>
      toast.error("Couldn't schedule the visit. Please try again."),
  });

  const canSubmit = shelterID !== "" && visitTime !== "" && !mutation.isPending;

  return (
    <SlideOver open={open} onClose={onClose} title="Schedule a Visit">
      <form
        className="flex flex-col gap-4 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) mutation.mutate();
        }}
      >
        <div>
          <label className={labelClass} htmlFor="visit-shelter">
            Shelter
          </label>
          <select
            id="visit-shelter"
            required
            value={shelterID}
            onChange={(e) => {
              setShelterID(e.target.value ? Number(e.target.value) : "");
              setPetID("");
            }}
            className={fieldClass}
          >
            <option value="" disabled>
              Select a shelter…
            </option>
            {shelters?.map((shelter) => (
              <option key={shelter.shelterID} value={shelter.shelterID}>
                {shelter.shelterName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="visit-pet">
            Pet <span className="font-normal text-neutral-gray">(optional)</span>
          </label>
          <select
            id="visit-pet"
            value={petID}
            disabled={shelterID === ""}
            onChange={(e) =>
              setPetID(e.target.value ? Number(e.target.value) : "")
            }
            className={fieldClass}
          >
            <option value="">
              {shelterID === "" ? "Select a shelter first" : "General shelter visit — no specific pet"}
            </option>
            {shelterPets.map((pet) => (
              <option key={pet.petID} value={pet.petID}>
                {pet.petName} — {pet.breed.breedName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="visit-time">
            Date &amp; time
          </label>
          <input
            id="visit-time"
            type="datetime-local"
            required
            min={minDateTimeLocal()}
            value={visitTime}
            onChange={(e) => setVisitTime(e.target.value)}
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="visit-remarks">
            Remarks
          </label>
          <textarea
            id="visit-remarks"
            rows={4}
            maxLength={REMARKS_MAX}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Anything the shelter should know ahead of your visit…"
            className={`${fieldClass} resize-none`}
          />
          <p className="mt-1 text-right font-body text-xs text-neutral-gray">
            {remarks.length}/{REMARKS_MAX}
          </p>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-2 rounded-xl bg-teal-dark px-4 py-3 font-body text-sm font-medium text-white transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending ? "Scheduling…" : "Schedule Visit"}
        </button>
      </form>
    </SlideOver>
  );
};

export default ScheduleVisitPanel;
