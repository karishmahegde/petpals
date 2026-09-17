// PetFormPanel.tsx
// Create/Edit pet form — one panel, two modes, mirroring the admin
// dashboard's ShelterFormPanel (SlideOver, full-form-resent-on-save, no
// diffing). `petID` present -> edit mode, fetched fresh via the public
// GET /pets/:id (works for any adoptionStatus, unlike the public catalog
// list) so the form gets the full detail shape the shelter-scoped list
// item doesn't carry (breedID, color, height, weight, description). Edit
// mode also surfaces the photo gallery and a Danger Zone delete action —
// neither makes sense before the pet exists.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import { FaPaw, FaTimes } from "react-icons/fa";
import SlideOver from "../../../../../../components/ui/SlideOver";
import ConfirmActionModal from "../../../../../../components/ui/ConfirmActionModal";
import { getSpecies, getBreeds, getPetById } from "../../../../../../logic/api/petsApi";
import {
  createPet,
  updatePet,
  deletePet,
  getPetPhotos,
  uploadPetPhoto,
  deletePetPhoto,
  PET_ADOPTION_STATUS_VALUES,
  type CreatePetPayload,
  type PetAdoptionStatus,
  type PetSex,
  type PetSize,
} from "../../../../../../logic/api/staffPetsApi";

interface PetFormPanelProps {
  open: boolean;
  onClose: () => void;
  /** Present -> edit mode, fetched fresh from GET /pets/:id. Absent/null -> create mode. */
  petID?: number | null;
}

interface PetFormState {
  speciesID: string;
  breedID: string;
  petName: string;
  petDOB: string;
  petSex: PetSex | "";
  petColor: string;
  petSize: PetSize | "";
  intakeDate: string;
  petWeight: string;
  petHeight: string;
  petBGroup: string;
  petDesc: string;
  // Edit-only — create always starts a pet at "available" server-side, so
  // this is never sent (or shown) in create mode.
  adoptionStatus: PetAdoptionStatus | "";
}

const EMPTY_FORM: PetFormState = {
  speciesID: "",
  breedID: "",
  petName: "",
  petDOB: "",
  petSex: "",
  petColor: "",
  petSize: "",
  intakeDate: "",
  petWeight: "",
  petHeight: "",
  petBGroup: "",
  petDesc: "",
  adoptionStatus: "",
};

const PET_SEX_OPTIONS: { value: PetSex; label: string }[] = [
  { value: "M", label: "Male" },
  { value: "F", label: "Female" },
];
const PET_SIZE_OPTIONS: PetSize[] = ["Small", "Medium", "Large"];

const ADOPTION_STATUS_LABEL: Record<PetAdoptionStatus, string> = {
  incoming: "Incoming",
  available: "Available",
  pending: "Pending",
  adopted: "Adopted",
  fostered: "Fostered",
  transferred: "Transferred",
  deceased: "Deceased",
};

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const labelClass =
  "mb-1.5 block font-body text-sm font-semibold text-neutral-charcoal";
const fieldClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark";

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const PetFormPanel = ({ open, onClose, petID }: PetFormPanelProps) => {
  const queryClient = useQueryClient();
  const isEdit = petID != null;

  const [form, setForm] = useState<PetFormState>(EMPTY_FORM);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const { data: species } = useQuery({
    queryKey: ["species"],
    queryFn: getSpecies,
    enabled: open,
  });

  const speciesIDNum = form.speciesID ? Number(form.speciesID) : null;
  const { data: breeds } = useQuery({
    queryKey: ["breeds", speciesIDNum],
    queryFn: () => getBreeds([speciesIDNum!]),
    enabled: open && speciesIDNum !== null,
  });

  const petQuery = useQuery({
    queryKey: ["pet", petID],
    queryFn: () => getPetById(petID!),
    enabled: open && isEdit,
  });

  const photosQuery = useQuery({
    queryKey: ["staff", "pet-photos", petID],
    queryFn: () => getPetPhotos(petID!),
    enabled: open && isEdit,
  });

  // Re-seed on every open: create mode -> blank form; edit mode -> wait for
  // the detail fetch, then pre-fill (including deriving speciesID from the
  // breed's speciesName, since the detail shape has no speciesID directly).
  useEffect(() => {
    if (!open) return;
    if (!isEdit) {
      setForm(EMPTY_FORM);
      return;
    }
    if (!petQuery.data || !species) return;
    const pet = petQuery.data;
    const matchedSpecies = species.find(
      (s) => s.speciesName === pet.breed.speciesName,
    );
    setForm({
      speciesID: matchedSpecies ? String(matchedSpecies.speciesID) : "",
      breedID: String(pet.breed.breedID),
      petName: pet.petName,
      petDOB: "", // not returned by GET /pets/:id (only the formatted petAge is) — left for staff to re-enter if changing it
      petSex: pet.petSex === "Male" ? "M" : pet.petSex === "Female" ? "F" : "",
      petColor: pet.petColor,
      petSize: "", // not returned by GET /pets/:id — left for staff to re-enter if changing it
      intakeDate: "",
      petWeight: String(pet.petWeight),
      petHeight: String(pet.petHeight),
      petBGroup: "",
      petDesc: pet.petDesc ?? "",
      adoptionStatus: pet.adoptionStatus,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, petQuery.data, species]);

  const resetPhotoForm = () => {
    setPhotoFile(null);
    setPhotoError(null);
  };

  const closeAndReset = () => {
    resetPhotoForm();
    setIsDeleteOpen(false);
    onClose();
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: CreatePetPayload = {
        breedID: Number(form.breedID),
        petName: form.petName.trim(),
        petDOB: form.petDOB,
        petSex: form.petSex as PetSex,
        petColor: form.petColor.trim(),
        petSize: form.petSize as PetSize,
        intakeDate: form.intakeDate,
        petWeight: Number(form.petWeight),
        petHeight: Number(form.petHeight),
      };
      if (form.petBGroup.trim()) payload.petBGroup = form.petBGroup.trim();

      if (!isEdit) return createPet(payload);

      return updatePet(petID!, {
        ...payload,
        petDesc: form.petDesc.trim() || null,
        adoptionStatus: form.adoptionStatus as PetAdoptionStatus,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "shelter-pets"] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ["pet", petID] });
      toast.success(isEdit ? "Pet updated" : "Pet created");
      closeAndReset();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadPetPhoto(petID!, { file }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["staff", "pet-photos", petID],
      });
      queryClient.invalidateQueries({ queryKey: ["staff", "shelter-pets"] });
      toast.success("Photo uploaded");
      resetPhotoForm();
    },
    onError: (err) => setPhotoError(extractError(err)),
  });

  const deletePhotoMutation = useMutation({
    mutationFn: (photoID: number) => deletePetPhoto(petID!, photoID),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["staff", "pet-photos", petID],
      });
      queryClient.invalidateQueries({ queryKey: ["staff", "shelter-pets"] });
      toast.success("Photo removed");
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const deletePetMutation = useMutation({
    mutationFn: () => deletePet(petID!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "shelter-pets"] });
      toast.success("Pet deleted");
      closeAndReset();
    },
    onError: (err) => {
      toast.error(extractError(err));
      setIsDeleteOpen(false);
    },
  });

  const handlePhotoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoFile) {
      setPhotoError("Please choose a photo to upload.");
      return;
    }
    if (!ALLOWED_PHOTO_MIME.has(photoFile.type)) {
      setPhotoError("Unsupported file type. Allowed: JPEG, PNG, WebP.");
      return;
    }
    if (photoFile.size > MAX_PHOTO_BYTES) {
      setPhotoError("File exceeds the 5 MB limit.");
      return;
    }
    setPhotoError(null);
    uploadMutation.mutate(photoFile);
  };

  const canSubmit =
    form.breedID !== "" &&
    form.petName.trim() !== "" &&
    form.petDOB !== "" &&
    form.petSex !== "" &&
    form.petColor.trim() !== "" &&
    form.petSize !== "" &&
    form.intakeDate !== "" &&
    form.petWeight !== "" &&
    form.petHeight !== "" &&
    (!isEdit || form.adoptionStatus !== "") &&
    !saveMutation.isPending;

  const photos = photosQuery.data ?? [];

  return (
    <>
      <SlideOver
        open={open}
        onClose={closeAndReset}
        title={isEdit ? "Edit Pet" : "Add Pet"}
      >
        {isEdit && petQuery.isLoading && (
          <p className="p-6 font-body text-sm text-neutral-gray">
            Loading pet…
          </p>
        )}

        {isEdit && petQuery.data && (
          <div className="px-6 pt-6">
            <div className="flex items-center gap-4 rounded-xl border-2 border-gold bg-gold-lightest p-4">
              {petQuery.data.petPhoto ? (
                <img
                  src={petQuery.data.petPhoto}
                  alt={`${petQuery.data.petName} photo`}
                  className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-teal-dark"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-neutral-offwhite ring-2 ring-teal-dark">
                  <FaPaw className="h-6 w-6 text-rose-md" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-body font-bold text-neutral-charcoal">
                  {petQuery.data.petName}
                </p>
                <p className="truncate font-body text-xs text-neutral-gray">
                  {petQuery.data.breed.breedName} ·{" "}
                  {petQuery.data.shelter.shelterName}
                </p>
              </div>
            </div>
          </div>
        )}

        {(!isEdit || petQuery.data) && (
          <form
            className="flex flex-col gap-4 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) saveMutation.mutate();
            }}
          >
            <div>
              <label className={labelClass} htmlFor="pet-species">
                Species
              </label>
              <select
                id="pet-species"
                required
                value={form.speciesID}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    speciesID: e.target.value,
                    breedID: "",
                  }))
                }
                className={fieldClass}
              >
                <option value="">- Select -</option>
                {species?.map((s) => (
                  <option key={s.speciesID} value={s.speciesID}>
                    {s.speciesName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass} htmlFor="pet-breed">
                Breed
              </label>
              <select
                id="pet-breed"
                required
                disabled={speciesIDNum === null}
                value={form.breedID}
                onChange={(e) =>
                  setForm((f) => ({ ...f, breedID: e.target.value }))
                }
                className={`${fieldClass} disabled:opacity-50`}
              >
                <option value="">
                  {speciesIDNum === null ? "Select a species first" : "- Select -"}
                </option>
                {breeds?.map((b) => (
                  <option key={b.breedID} value={b.breedID}>
                    {b.breedName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass} htmlFor="pet-name">
                Name
              </label>
              <input
                id="pet-name"
                required
                maxLength={45}
                value={form.petName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, petName: e.target.value }))
                }
                className={fieldClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="pet-dob">
                  Date of birth
                </label>
                <input
                  id="pet-dob"
                  type="date"
                  required
                  value={form.petDOB}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, petDOB: e.target.value }))
                  }
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pet-sex">
                  Sex
                </label>
                <select
                  id="pet-sex"
                  required
                  value={form.petSex}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      petSex: e.target.value as PetSex,
                    }))
                  }
                  className={fieldClass}
                >
                  <option value="">- Select -</option>
                  {PET_SEX_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="pet-color">
                  Color
                </label>
                <input
                  id="pet-color"
                  required
                  maxLength={45}
                  value={form.petColor}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, petColor: e.target.value }))
                  }
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pet-size">
                  Size
                </label>
                <select
                  id="pet-size"
                  required
                  value={form.petSize}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      petSize: e.target.value as PetSize,
                    }))
                  }
                  className={fieldClass}
                >
                  <option value="">- Select -</option>
                  {PET_SIZE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="pet-weight">
                  Weight (kg)
                </label>
                <input
                  id="pet-weight"
                  type="number"
                  required
                  min={0.1}
                  step="0.1"
                  value={form.petWeight}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, petWeight: e.target.value }))
                  }
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pet-height">
                  Height (cm)
                </label>
                <input
                  id="pet-height"
                  type="number"
                  required
                  min={0.1}
                  step="0.1"
                  value={form.petHeight}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, petHeight: e.target.value }))
                  }
                  className={fieldClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor="pet-intake-date">
                Intake date
              </label>
              <input
                id="pet-intake-date"
                type="date"
                required
                value={form.intakeDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, intakeDate: e.target.value }))
                }
                className={fieldClass}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="pet-bgroup">
                Blood group{" "}
                <span className="font-normal text-neutral-gray">
                  (optional — defaults to "N/A")
                </span>
              </label>
              <input
                id="pet-bgroup"
                maxLength={5}
                value={form.petBGroup}
                onChange={(e) =>
                  setForm((f) => ({ ...f, petBGroup: e.target.value }))
                }
                className={fieldClass}
              />
            </div>

            {isEdit && (
              <div>
                <label className={labelClass} htmlFor="pet-status">
                  Status
                </label>
                <select
                  id="pet-status"
                  required
                  value={form.adoptionStatus}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      adoptionStatus: e.target.value as PetAdoptionStatus,
                    }))
                  }
                  className={fieldClass}
                >
                  {PET_ADOPTION_STATUS_VALUES.map((status) => (
                    <option key={status} value={status}>
                      {ADOPTION_STATUS_LABEL[status]}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isEdit && (
              <div>
                <label className={labelClass} htmlFor="pet-desc">
                  Description
                </label>
                <textarea
                  id="pet-desc"
                  rows={3}
                  maxLength={500}
                  value={form.petDesc}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, petDesc: e.target.value }))
                  }
                  className={fieldClass}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-2 rounded-xl bg-green px-4 py-3 font-body text-sm font-medium text-white transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveMutation.isPending
                ? isEdit
                  ? "Saving…"
                  : "Creating…"
                : isEdit
                  ? "Save"
                  : "Create Pet"}
            </button>
          </form>
        )}

        {isEdit && petQuery.data && (
          <div className="border-t border-neutral-lightgray p-6">
            <h3 className="mb-4 font-display text-lg text-neutral-dark">
              Photos
            </h3>

            {photos.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-3">
                {photos.map((photo) => (
                  <div key={photo.photoID} className="relative">
                    <img
                      src={photo.photoURL}
                      alt=""
                      className={`h-20 w-20 rounded-lg object-cover ${
                        photo.isPrimary
                          ? "ring-2 ring-gold-md"
                          : "ring-1 ring-neutral-lightgray"
                      }`}
                    />
                    {photo.isPrimary && (
                      <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full bg-gold-md px-1.5 py-0.5 font-body text-[10px] font-medium text-white">
                        Primary
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => deletePhotoMutation.mutate(photo.photoID)}
                      disabled={deletePhotoMutation.isPending}
                      aria-label="Remove photo"
                      title="Remove photo"
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-dark text-white shadow-sm hover:brightness-90 disabled:opacity-50"
                    >
                      <FaTimes className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {photos.length === 0 && !photosQuery.isLoading && (
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-lg bg-neutral-offwhite">
                <FaPaw className="h-8 w-8 text-rose-md" aria-hidden />
              </div>
            )}

            <form
              onSubmit={handlePhotoSubmit}
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <label
                  htmlFor="pet-photo-file"
                  className="font-body text-xs text-neutral-gray"
                >
                  Add a photo (JPEG, PNG, or WebP - max 5 MB)
                </label>
                <input
                  id="pet-photo-file"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={(e) =>
                    setPhotoFile(e.target.files?.[0] ?? null)
                  }
                  className="mt-1 w-full font-body text-xs text-neutral-charcoal file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-light file:px-3 file:py-1.5 file:font-body file:text-sm file:font-medium file:text-neutral-dark hover:file:bg-rose-light"
                />
              </div>
              <button
                type="submit"
                disabled={uploadMutation.isPending}
                className="shrink-0 rounded-xl bg-rose-dark px-4 py-2 font-body text-sm font-medium text-white transition-colors hover:brightness-90 disabled:opacity-50"
              >
                {uploadMutation.isPending ? "Uploading…" : "Upload"}
              </button>
            </form>
            {photoError && (
              <p className="mt-2 rounded-lg bg-rose-lightest px-4 py-2 font-body text-sm text-rose-dark">
                {photoError}
              </p>
            )}
          </div>
        )}

        {isEdit && petQuery.data && (
          <div className="border-t border-neutral-lightgray p-6">
            <div className="rounded-2xl border border-rose-md bg-rose-lightest p-4">
              <h3 className="font-display text-lg text-rose-dark">
                Danger zone
              </h3>
              <p className="mt-1 font-body text-sm text-neutral-charcoal">
                Deleting a pet removes its profile and photos for good. This
                is blocked while it has a Pending or Accepted application.
              </p>
              <button
                type="button"
                onClick={() => setIsDeleteOpen(true)}
                className="mt-3 rounded-xl border border-rose-dark px-4 py-2 font-body text-sm font-medium text-rose-dark transition-colors hover:bg-rose-dark hover:text-white"
              >
                Delete pet
              </button>
            </div>
          </div>
        )}
      </SlideOver>

      <ConfirmActionModal
        isOpen={isDeleteOpen}
        title="Delete this pet?"
        confirmLabel="Delete"
        isPending={deletePetMutation.isPending}
        onCancel={() => setIsDeleteOpen(false)}
        onConfirm={() => deletePetMutation.mutate()}
      >
        This permanently removes {petQuery.data?.petName ?? "this pet"}'s
        profile and photos. This can't be undone.
      </ConfirmActionModal>
    </>
  );
};

export default PetFormPanel;
