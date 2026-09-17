// ShelterFormPanel.tsx
// Create/Edit shelter form — one panel, two modes. `shelter` present → edit
// mode, pre-filled from that row's data; absent → create mode. Edit mode also
// surfaces Manager and Shelter Status (new shelters can't have either yet — a
// new shelter always starts Open with no staff to assign), and Save fires all
// the changed endpoints together: PUT for the base fields, PATCH .../status
// and PATCH .../manager only when those actually changed.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import SlideOver from "../../../../../../components/ui/SlideOver";
import PhoneInputField from "../../../../../../components/ui/PhoneInputField";
import {
  createShelter,
  updateShelter,
  updateShelterStatus,
  updateShelterManager,
  type ShelterStatus,
} from "../../../../../../logic/api/sheltersApi";
import { getStaff } from "../../../../../../logic/api/staffApi";
import type { ShelterAnalyticsItem } from "../../../../../../logic/api/analyticsApi";

interface ShelterFormPanelProps {
  open: boolean;
  onClose: () => void;
  /** Present → edit mode, pre-filled from this row. Absent/null → create mode. */
  shelter?: ShelterAnalyticsItem | null;
}

interface ShelterFormState {
  shelterName: string;
  shelterAddress: string;
  shelterPhone: string;
  shelterEmail: string;
  shelterZIP: string;
  shelterSize: string;
  shelterStatus: ShelterStatus;
  // "" = no manager assigned. Only meaningful/shown in edit mode.
  managerStaffID: string;
}

const EMPTY_FORM: ShelterFormState = {
  shelterName: "",
  shelterAddress: "",
  shelterPhone: "",
  shelterEmail: "",
  shelterZIP: "",
  shelterSize: "",
  shelterStatus: "Open",
  managerStaffID: "",
};

const STATUS_OPTIONS: ShelterStatus[] = ["Open", "Full", "Closed"];

const labelClass =
  "mb-1.5 block font-body text-sm font-semibold text-neutral-charcoal";
const fieldClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark";

const ShelterFormPanel = ({
  open,
  onClose,
  shelter,
}: ShelterFormPanelProps) => {
  const queryClient = useQueryClient();
  const isEdit = shelter != null;

  const [form, setForm] = useState<ShelterFormState>(EMPTY_FORM);

  // Re-seed every time the panel opens — the edit row's current data, or a
  // blank form for create.
  useEffect(() => {
    if (!open) return;
    setForm(
      shelter
        ? {
            shelterName: shelter.shelterName,
            shelterAddress: shelter.shelterAddress,
            shelterPhone: shelter.shelterPhone,
            shelterEmail: shelter.shelterEmail,
            shelterZIP: String(shelter.shelterZIP),
            shelterSize: String(shelter.shelterSize),
            shelterStatus: shelter.shelterStatus,
            managerStaffID:
              shelter.managerStaffID != null
                ? String(shelter.managerStaffID)
                : "",
          }
        : EMPTY_FORM,
    );
  }, [open, shelter]);

  // This shelter's active staff, for the Manager dropdown — edit mode only.
  const { data: staff } = useQuery({
    queryKey: ["admin", "staff-by-shelter", shelter?.shelterID],
    queryFn: () =>
      getStaff({
        shelterID: shelter!.shelterID,
        accountStatus: "Active",
        limit: 100,
      }),
    enabled: open && isEdit,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        shelterName: form.shelterName.trim(),
        shelterAddress: form.shelterAddress.trim(),
        shelterPhone: form.shelterPhone,
        shelterEmail: form.shelterEmail.trim(),
        shelterZIP: Number(form.shelterZIP),
        shelterSize: Number(form.shelterSize),
      };

      if (!isEdit) return createShelter(payload);

      const updated = await updateShelter(shelter!.shelterID, payload);
      if (form.shelterStatus !== shelter!.shelterStatus) {
        await updateShelterStatus(shelter!.shelterID, form.shelterStatus);
      }
      const nextManagerStaffID =
        form.managerStaffID === "" ? null : Number(form.managerStaffID);
      if (
        nextManagerStaffID !== null &&
        nextManagerStaffID !== shelter!.managerStaffID
      ) {
        await updateShelterManager(shelter!.shelterID, nextManagerStaffID);
      }
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "shelters-analytics"],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin", "analytics-overview"],
      });
      toast.success(isEdit ? "Shelter updated" : "Shelter created");
      onClose();
    },
    onError: () =>
      toast.error(
        `Couldn't ${isEdit ? "update" : "create"} the shelter. Please try again.`,
      ),
  });

  const canSubmit =
    form.shelterName.trim() !== "" &&
    form.shelterAddress.trim() !== "" &&
    form.shelterPhone !== "" &&
    form.shelterEmail.trim() !== "" &&
    form.shelterZIP !== "" &&
    form.shelterSize !== "" &&
    !mutation.isPending;

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Shelter" : "Add Shelter"}
    >
      <form
        className="flex flex-col gap-4 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) mutation.mutate();
        }}
      >
        <div>
          <label className={labelClass} htmlFor="shelter-name">
            Shelter Name
          </label>
          <input
            id="shelter-name"
            required
            maxLength={45}
            value={form.shelterName}
            onChange={(e) =>
              setForm((f) => ({ ...f, shelterName: e.target.value }))
            }
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="shelter-email">
            Email
          </label>
          <input
            id="shelter-email"
            type="email"
            required
            maxLength={45}
            value={form.shelterEmail}
            onChange={(e) =>
              setForm((f) => ({ ...f, shelterEmail: e.target.value }))
            }
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="shelter-phone">
            Phone
          </label>
          <PhoneInputField
            id="shelter-phone"
            value={form.shelterPhone}
            onChange={(next) =>
              setForm((f) => ({ ...f, shelterPhone: next ?? "" }))
            }
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="shelter-address">
            Address
          </label>
          <input
            id="shelter-address"
            required
            maxLength={45}
            value={form.shelterAddress}
            onChange={(e) =>
              setForm((f) => ({ ...f, shelterAddress: e.target.value }))
            }
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="shelter-zip">
            Zip Code
          </label>
          <input
            id="shelter-zip"
            type="number"
            required
            min={1}
            value={form.shelterZIP}
            onChange={(e) =>
              setForm((f) => ({ ...f, shelterZIP: e.target.value }))
            }
            className={fieldClass}
          />
        </div>

        {isEdit && (
          <div>
            <label className={labelClass} htmlFor="shelter-manager">
              Manager
            </label>
            <select
              id="shelter-manager"
              value={form.managerStaffID}
              onChange={(e) =>
                setForm((f) => ({ ...f, managerStaffID: e.target.value }))
              }
              className={fieldClass}
            >
              <option value="">No manager assigned</option>
              {staff?.map((member) => (
                <option key={member.userID} value={member.userID}>
                  {member.staffName}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="shelter-size">
            Max. Capacity
          </label>
          <input
            id="shelter-size"
            type="number"
            required
            min={1}
            value={form.shelterSize}
            onChange={(e) =>
              setForm((f) => ({ ...f, shelterSize: e.target.value }))
            }
            className={fieldClass}
          />
        </div>

        {isEdit && (
          <div>
            <label className={labelClass} htmlFor="shelter-status">
              Shelter Status
            </label>
            <select
              id="shelter-status"
              value={form.shelterStatus}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  shelterStatus: e.target.value as ShelterStatus,
                }))
              }
              className={fieldClass}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-2 rounded-xl bg-green px-4 py-3 font-body text-sm font-medium text-white transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending
            ? isEdit
              ? "Saving…"
              : "Creating…"
            : isEdit
              ? "Save"
              : "Create Shelter"}
        </button>
      </form>
    </SlideOver>
  );
};

export default ShelterFormPanel;
