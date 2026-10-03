// VaccineFormPanel.tsx
// The Vaccinations tab's Add/Edit Vaccine slide-over — name, manufacturer
// and description for one catalog vaccine (POST /vaccines, or PUT
// /vaccines/:id when `vaccine` is set). The page owns which vaccine is open;
// the form resets from `vaccine` every time the panel opens. Saving
// invalidates every ["vaccines"] query, so the record-dose picker on the
// Appointments tab sees the change too.
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import SlideOver from "../../../../../../components/ui/SlideOver";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import {
  createVaccine,
  updateVaccine,
  type Vaccine,
  type VaccinePayload,
} from "../../../../../../logic/api/vaccinationsApi";

// server: Vaccine.vaccineName/manufacturer VarChar(45), vaccineDesc VarChar(500)
const MAX_NAME_LEN = 45;
const MAX_DESC_LEN = 500;

const fieldClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2 font-body text-sm text-neutral-dark placeholder:italic placeholder:text-neutral-gray focus:border-teal-dark focus:outline-none";
const labelClass = "mb-1 block font-body text-sm font-semibold text-neutral-dark";

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const toPayload = (name: string, manufacturer: string, desc: string): VaccinePayload => ({
  vaccineName: name.trim(),
  manufacturer: manufacturer.trim() || null,
  vaccineDesc: desc.trim() || null,
});

interface VaccineFormPanelProps {
  open: boolean;
  onClose: () => void;
  /** The vaccine being edited; null to add a new one. */
  vaccine: Vaccine | null;
}

const VaccineFormPanel = ({ open, onClose, vaccine }: VaccineFormPanelProps) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [desc, setDesc] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: Partial<VaccinePayload>) =>
      vaccine
        ? updateVaccine(vaccine.vaccineID, payload)
        : createVaccine(payload as VaccinePayload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vaccines"] });
      toast.success(vaccine ? "Vaccine updated" : "Vaccine added");
      onClose();
    },
    onError: (err) => setError(extractError(err)),
  });
  const { reset } = mutation;

  // Re-seed the form whenever the panel opens (or switches vaccine).
  useEffect(() => {
    if (!open) return;
    setName(vaccine?.vaccineName ?? "");
    setManufacturer(vaccine?.manufacturer ?? "");
    setDesc(vaccine?.vaccineDesc ?? "");
    setError(null);
    reset();
  }, [open, vaccine, reset]);

  const handleSave = () => {
    const next = toPayload(name, manufacturer, desc);
    if (!next.vaccineName) {
      setError("Vaccine name is required.");
      return;
    }
    if (!vaccine) {
      mutation.mutate(next);
      return;
    }
    // Edit: only send what changed.
    const changed: Partial<VaccinePayload> = {};
    if (next.vaccineName !== vaccine.vaccineName) changed.vaccineName = next.vaccineName;
    if (next.manufacturer !== vaccine.manufacturer) changed.manufacturer = next.manufacturer;
    if (next.vaccineDesc !== vaccine.vaccineDesc) changed.vaccineDesc = next.vaccineDesc;
    if (Object.keys(changed).length === 0) {
      onClose();
      return;
    }
    mutation.mutate(changed);
  };

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={vaccine ? "Edit Vaccine" : "Add Vaccine"}
      footer={
        <ButtonElement
          onClick={handleSave}
          disabled={mutation.isPending}
          size="panel"
          className="w-full bg-gold-md hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : "Save"}
        </ButtonElement>
      }
    >
      <div className="flex flex-col gap-4 p-6 pt-2">
        <div>
          <label htmlFor="vaccine-name" className={labelClass}>
            Vaccine Name
          </label>
          <input
            id="vaccine-name"
            type="text"
            value={name}
            maxLength={MAX_NAME_LEN}
            placeholder="Vaccine Name"
            onChange={(e) => setName(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="vaccine-manufacturer" className={labelClass}>
            Manufacturer
          </label>
          <input
            id="vaccine-manufacturer"
            type="text"
            value={manufacturer}
            maxLength={MAX_NAME_LEN}
            placeholder="Manufacturer"
            onChange={(e) => setManufacturer(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="vaccine-desc" className={labelClass}>
            Description
          </label>
          <textarea
            id="vaccine-desc"
            value={desc}
            maxLength={MAX_DESC_LEN}
            rows={6}
            placeholder="What it protects against, and which species it's for"
            onChange={(e) => setDesc(e.target.value)}
            className={`${fieldClass} resize-none`}
          />
          <p className="mt-1 text-right font-body text-xs text-neutral-gray">
            {desc.length}/{MAX_DESC_LEN}
          </p>
        </div>

        {error && (
          <p className="rounded-lg bg-rose-lightest px-4 py-2 font-body text-sm text-rose-dark">
            {error}
          </p>
        )}
      </div>
    </SlideOver>
  );
};

export default VaccineFormPanel;
